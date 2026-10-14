require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 5000);
const isProduction = process.env.NODE_ENV === 'production';
const useMySql = process.env.STORAGE?.toLowerCase() === 'mysql';
const storageName = useMySql ? 'MySQL' : 'JSON file';
const configuredOrigins = (process.env.CORS_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
const allowedOrigins = configuredOrigins.length ? configuredOrigins : (isProduction ? [] : ['http://localhost:5173', 'http://127.0.0.1:5173']);
const dataDirectory = path.join(__dirname, 'data');
const cataloguePath = path.join(dataDirectory, 'accessbridge.json');
const historyPath = path.join(dataDirectory, 'search-history.json');
const speechVoices = {
  'hi-IN-SwaraNeural': 'hi-IN',
  'hi-IN-MadhurNeural': 'hi-IN',
  'te-IN-ShrutiNeural': 'te-IN',
  'te-IN-MohanNeural': 'te-IN'
};
const speechRequestCounts = new Map();
const SPEECH_RATE_WINDOW_MS = 60_000;
const SPEECH_RATE_LIMIT = 20;
const OFFICIAL_SOURCES = [
  { id: 'myscheme', name: 'myScheme — Government Scheme Finder', url: 'https://www.myscheme.gov.in/', dataUrl: 'https://www.myscheme.gov.in/about', purpose: 'Central and state/UT scheme discovery', host: 'www.myscheme.gov.in' },
  { id: 'nsp', name: 'National Scholarship Portal', url: 'https://scholarships.gov.in/All-Scholarships', dataUrl: 'https://scholarships.gov.in/Students', purpose: 'Scholarship listings and academic-year announcements', host: 'scholarships.gov.in' },
  { id: 'ncs', name: 'National Career Service', url: 'https://www.ncs.gov.in/', dataUrl: 'https://www.ncs.gov.in/', purpose: 'Career and employment services', host: 'www.ncs.gov.in' },
  { id: 'uidai', name: 'UIDAI — Aadhaar', url: 'https://uidai.gov.in/', dataUrl: 'https://uidai.gov.in/', purpose: 'Aadhaar services and official guidance', host: 'uidai.gov.in' },
  { id: 'digilocker', name: 'DigiLocker', url: 'https://www.digilocker.gov.in/', dataUrl: 'https://www.digilocker.gov.in/', purpose: 'Digital documents and certificates', host: 'www.digilocker.gov.in' },
  { id: 'india-gov', name: 'National Portal of India', url: 'https://www.india.gov.in/', dataUrl: 'https://www.india.gov.in/', purpose: 'Government department and service directory', host: 'www.india.gov.in' },
  { id: 'aicte', name: 'All India Council for Technical Education', url: 'https://www.aicte-india.org/', dataUrl: 'https://www.aicte-india.org/', purpose: 'Technical education information', host: 'www.aicte-india.org' },
  { id: 'data-gov', name: 'Open Government Data Platform India', url: 'https://www.data.gov.in/', dataUrl: 'https://www.data.gov.in/', purpose: 'Published datasets; API access is dataset-specific', host: 'www.data.gov.in' }
];
const APPROVED_SOURCE_HOSTS = new Set([
  'www.myscheme.gov.in', 'myscheme.gov.in', 'scholarships.gov.in', 'www.ncs.gov.in', 'ncs.gov.in',
  'uidai.gov.in', 'www.uidai.gov.in', 'www.digilocker.gov.in', 'digilocker.gov.in', 'www.india.gov.in',
  'india.gov.in', 'www.aicte-india.org', 'aicte-india.org', 'www.data.gov.in', 'data.gov.in', 'ap.data.gov.in',
  'pmvidyalaxmi.co.in', 'www.pmvidyalaxmi.co.in'
]);
const sourceStatusCache = new Map();
let sourceCheckInFlight = null;
const SOURCE_CACHE_MS = 10 * 60 * 1000;
let localSchemes = [];
let localHistory = [];
let historyWrite = Promise.resolve();
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'accessbridge',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
  decimalNumbers: true
});

app.disable('x-powered-by');
app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.includes(origin)) return callback(null, true); return callback(null, false); }, methods: ['GET','POST','OPTIONS'], allowedHeaders: ['Content-Type'], optionsSuccessStatus: 204 }));
app.use(express.json({ limit: '20kb' }));

function normalize(value, max = 100) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function escapeXml(value) {
  return value.replace(/[<>&'"]/g, character => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character]);
}
function isSpeechRateLimited(ip) {
  const now = Date.now();
  for (const [address, entry] of speechRequestCounts) {
    if (now - entry.startedAt >= SPEECH_RATE_WINDOW_MS) speechRequestCounts.delete(address);
  }
  const current = speechRequestCounts.get(ip);
  if (!current || now - current.startedAt >= SPEECH_RATE_WINDOW_MS) {
    speechRequestCounts.set(ip, { startedAt: now, count: 1 });
    return false;
  }
  if (current.count >= SPEECH_RATE_LIMIT) return true;
  current.count++;
  return false;
}
function isApprovedOfficialUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && APPROVED_SOURCE_HOSTS.has(u.hostname.toLowerCase()); } catch { return false; }
}
function publicScheme(scheme) {
  const { active, ...rest } = scheme;
  let sourceHost = null;
  try { const u = new URL(rest.source || rest.url); sourceHost = u.hostname.toLowerCase(); } catch {}
  const approved = isApprovedOfficialUrl(rest.source || rest.url) && isApprovedOfficialUrl(rest.url);
  return { ...rest, sourceHost, sourceApproved: approved,
    sourcePolicy: approved ? 'Official portal allowlisted by AccessBridge; summary is a directory description, not a copied scheme rule.' : 'Source needs review; do not rely on this entry.' };
}
async function checkSource(source) {
  const cached = sourceStatusCache.get(source.id);
  if (cached && Date.now() - cached.checkedAtMs < SOURCE_CACHE_MS) return cached.value;
  const started = Date.now();
  let value;
  try {
    const sourceUrl = new URL(source.url);
    if (sourceUrl.protocol !== 'https:' || !APPROVED_SOURCE_HOSTS.has(sourceUrl.hostname.toLowerCase())) throw new Error('Source URL is not allowlisted');
    const response = await fetch(source.url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(6500), headers: { 'User-Agent': 'AccessBridge-OfficialSourceChecker/1.0 (portal link health check)' } });
    let finalHost = '';
    try { finalHost = new URL(response.url || source.url).hostname.toLowerCase(); } catch {}
    if (finalHost && !APPROVED_SOURCE_HOSTS.has(finalHost)) {
      value = { id: source.id, name: source.name, url: source.url, purpose: source.purpose, status: 'redirect_review', reachable: false, httpStatus: response.status, checkedAt: new Date().toISOString(), note: 'The link redirected outside the approved source list; it is not marked verified.' };
    } else {
      const limitedCheck = [403, 405].includes(response.status);
      const reachable = response.status < 500;
      value = { id: source.id, name: source.name, url: source.url, purpose: source.purpose, status: limitedCheck ? 'check_limited' : (response.status >= 400 ? 'responded_with_error' : (response.status >= 300 ? 'redirected' : 'reachable')), reachable, httpStatus: response.status, checkedAt: new Date().toISOString(), latencyMs: Date.now() - started, note: limitedCheck ? 'The portal restricts automated HEAD checks; open the source directly to verify content.' : (response.status >= 400 ? 'The portal returned an error to this check. This does not prove the source content is false.' : 'This checks link reachability only, not the truth or freshness of every scheme detail.') };
    }
  } catch (error) {
    value = { id: source.id, name: source.name, url: source.url, purpose: source.purpose, status: 'check_failed', reachable: false, httpStatus: null, checkedAt: new Date().toISOString(), note: error.name === 'TimeoutError' ? 'Timed out while checking the portal. Try opening the official source directly.' : 'Could not check this portal from the server. No scheme facts are inferred from this failure.' };
  }
  sourceStatusCache.set(source.id, { checkedAtMs: Date.now(), value });
  return value;
}
async function getOfficialSourceStatuses(force = false) {
  if (force) sourceStatusCache.clear();
  if (sourceCheckInFlight) return sourceCheckInFlight;
  sourceCheckInFlight = Promise.all(OFFICIAL_SOURCES.map(checkSource)).finally(() => { sourceCheckInFlight = null; });
  return sourceCheckInFlight;
}
function parseJson(value, fallback = []) { if (Array.isArray(value)) return value; if (value == null) return fallback; try { return JSON.parse(value); } catch { return fallback; } }
function rowToScheme(row) {
  return { id: row.id, name: row.name, category: row.category, icon: row.icon, description: row.description, audience: row.audience,
    states: parseJson(row.states_json), education: parseJson(row.education_json), documents: parseJson(row.documents_json), verify: parseJson(row.verify_json),
    url: row.url, source: row.source, lastVerified: row.last_verified, active: Boolean(row.active) };
}
async function getSchemes() {
  if (!useMySql) return localSchemes;
  const [rows] = await pool.query('SELECT * FROM schemes ORDER BY sort_order ASC, name ASC');
  return rows.map(rowToScheme);
}

// The voice assistant searches the local directory and only returns allowlisted official portal URLs.
// It deliberately does not generate scheme eligibility, benefit amounts, or deadlines.
const ASSISTANT_INTENTS = [
  { ids: ['nsp', 'pmvidyalaxmi', 'aicte'], terms: ['scholarship','scholarships','student','students','education','study','studies','school','college','university','fees','fee','tuition','loan','financial help','daughter','son','చదువు','విద్య','స్కాలర్','ఫీజు','ఫీజులు','విద్యార్థి','కాలేజీ','సహాయం','बच्चों की पढ़ाई','पढ़ाई','छात्रवृत्ति','छात्रवृत्ति','स्कॉलरशिप','फीस','कॉलेज','शिक्षा','बेटी','बेटे','पढ़ने','ऋण','ಶಿಕ್ಷಣ','ವಿದ್ಯಾರ್ಥಿ','ಶುಲ್ಕ','ಓದು'] },
  { ids: ['ncs'], terms: ['job','jobs','career','employment','work','vacancy','resume','నౌకరీ','ఉద్యోగం','ఉద్యోగాలు','పని','ఉద్యోగ','नौकरी','रोजगार','काम','नौकरियाँ','रोज़गार','ಕೆಲಸ','ಉದ್ಯೋಗ'] },
  { ids: ['uidai'], terms: ['aadhaar','aadhar','uidai','identity','update aadhaar','आधार','आधार कार्ड','आधार अपडेट','ఆధార్','ఆధార్ కార్డు','గుర్తింపు','ಗುರುತಿನ ಚೀಟಿ'] },
  { ids: ['digilocker', 'uidai'], terms: ['document','documents','certificate','certificates','marksheet','digital document','దృవపత్రం','ధృవపత్రాలు','సర్టిఫికెట్','పత్రాలు','డాక్యుమెంట్','प्रमाणपत्र','दस्तावेज़','दस्तावेज','मार्कशीट','ಪ್ರಮಾಣಪತ್ರ','ದಾಖಲೆ'] },
  { ids: ['myscheme', 'india-gov'], terms: ['government scheme','government schemes','welfare','pension','benefit','benefits','financial assistance','government help','scheme','schemes','పెన్షన్','ప్రభుత్వ పథకం','ప్రభుత్వ పథకాలు','ప్రభుత్వ సహాయం','లబ్ధి','ప్రయోజనం','పథకం','పథకాలు','పింఛను','सरकारी योजना','सरकारी योजनाएँ','सरकारी मदद','पेंशन','लाभ','योजना','योजनाएँ','ಸರ್ಕಾರಿ ಯೋಜನೆ','ಪಿಂಚಣಿ','ಸಹಾಯಧನ'] }
];
const ASSISTANT_TEXT = {
  en: {
    found: 'I found official starting points that may help. Open a source to confirm current details.',
    none: 'I could not find a close match in the current directory. You can explore the official scheme finder and national government portal below.',
    followUp: 'You can tell me whether you need education support, a job, identity documents, or a government scheme.',
    descriptions: {
      nsp: 'Explore scholarship listings and application information. The official portal determines the current schemes and eligibility.',
      pmvidyalaxmi: 'Explore official education-loan information. Check participating institutions, loan terms and current conditions on the portal.',
      ncs: 'Explore official career and employment services, job-search resources and career guidance.',
      uidai: 'Open the official Aadhaar portal for identity services, updates and guidance.',
      digilocker: 'Explore the official service for supported digital documents and certificates.',
      myscheme: 'Search central and state government schemes and read the eligibility conditions published by the scheme provider.',
      'india-gov': 'Find official government departments, public-service information and links to service portals.',
      aicte: 'Explore official technical-education information and resources from AICTE.'
    }
  },
  te: {
    found: 'మీకు ఉపయోగపడే అధికారిక ప్రారంభ వనరులను కనుగొన్నాను. తాజా వివరాల కోసం అధికారిక వెబ్‌సైట్‌ను తెరవండి.',
    none: 'ప్రస్తుత జాబితాలో సరిపోయే వనరు కనబడలేదు. క్రింద ఉన్న అధికారిక పథకాల పోర్టల్ లేదా జాతీయ ప్రభుత్వ పోర్టల్‌ను చూడవచ్చు.',
    followUp: 'మీకు చదువుకు సహాయం, ఉద్యోగం, గుర్తింపు పత్రాలు లేదా ప్రభుత్వ పథకం ఏది కావాలో చెప్పండి.',
    descriptions: {
      nsp: 'స్కాలర్‌షిప్‌ల జాబితా మరియు దరఖాస్తు సమాచారాన్ని చూడండి. ప్రస్తుతం అందుబాటులో ఉన్న పథకాలు, అర్హతను అధికారిక పోర్టల్‌లో నిర్ధారించండి.',
      pmvidyalaxmi: 'విద్యా రుణాల అధికారిక సమాచారాన్ని చూడండి. పాల్గొనే విద్యాసంస్థలు, రుణ నిబంధనలు మరియు తాజా వివరాలను పోర్టల్‌లో తనిఖీ చేయండి.',
      ncs: 'ఉద్యోగ శోధన, కెరీర్ మార్గదర్శకత్వం మరియు ఉపాధి సేవల కోసం అధికారిక పోర్టల్‌ను చూడండి.',
      uidai: 'ఆధార్ సేవలు, మార్పులు మరియు మార్గదర్శకత్వం కోసం అధికారిక UIDAI వెబ్‌సైట్‌ను తెరవండి.',
      digilocker: 'డిజిటల్ పత్రాలు మరియు సర్టిఫికెట్ల కోసం అధికారిక DigiLocker సేవను చూడండి.',
      myscheme: 'కేంద్ర మరియు రాష్ట్ర ప్రభుత్వ పథకాలను వెతికి, సంబంధిత పథకం ప్రచురించిన అర్హత నిబంధనలను చదవండి.',
      'india-gov': 'ప్రభుత్వ శాఖలు, ప్రజా సేవల సమాచారం మరియు అధికారిక సేవా లింకులను కనుగొనండి.',
      aicte: 'సాంకేతిక విద్యకు సంబంధించిన అధికారిక సమాచారం కోసం AICTE పోర్టల్‌ను చూడండి.'
    }
  },
  hi: {
    found: 'मुझे कुछ आधिकारिक शुरुआती स्रोत मिले हैं। ताज़ा जानकारी की पुष्टि के लिए आधिकारिक वेबसाइट खोलें।',
    none: 'मौजूदा सूची में उपयुक्त स्रोत नहीं मिला। नीचे दिए गए आधिकारिक योजना पोर्टल या राष्ट्रीय सरकारी पोर्टल को देखें।',
    followUp: 'बताएँ कि आपको पढ़ाई में मदद, नौकरी, पहचान दस्तावेज़ या सरकारी योजना चाहिए।',
    descriptions: {
      nsp: 'छात्रवृत्ति की सूची और आवेदन की जानकारी देखें। मौजूदा योजनाओं और पात्रता की पुष्टि आधिकारिक पोर्टल पर करें।',
      pmvidyalaxmi: 'शिक्षा ऋण की आधिकारिक जानकारी देखें। भाग लेने वाले संस्थानों, ऋण शर्तों और मौजूदा नियमों की पुष्टि करें।',
      ncs: 'नौकरी खोज, करियर मार्गदर्शन और रोजगार सेवाओं के लिए आधिकारिक पोर्टल देखें।',
      uidai: 'आधार सेवाओं, अपडेट और मार्गदर्शन के लिए आधिकारिक UIDAI वेबसाइट खोलें।',
      digilocker: 'डिजिटल दस्तावेज़ और प्रमाणपत्रों के लिए आधिकारिक DigiLocker सेवा देखें।',
      myscheme: 'केंद्र और राज्य की सरकारी योजनाएँ खोजें और संबंधित योजना द्वारा प्रकाशित पात्रता शर्तें पढ़ें।',
      'india-gov': 'सरकारी विभागों, सार्वजनिक सेवाओं की जानकारी और आधिकारिक सेवा लिंक खोजें।',
      aicte: 'तकनीकी शिक्षा की आधिकारिक जानकारी के लिए AICTE पोर्टल देखें।'
    }
  }
};
function assistantIntent(message) {
  const text = message.toLocaleLowerCase();
  const found = ASSISTANT_INTENTS.filter(intent => intent.terms.some(term => text.includes(term)));
  const ids = [...new Set(found.flatMap(intent => intent.ids))];
  return ids.length ? ids : ['myscheme', 'india-gov'];
}
async function initializeDatabase() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schemes (
    id VARCHAR(100) PRIMARY KEY, name VARCHAR(255) NOT NULL, category VARCHAR(100) NOT NULL,
    icon VARCHAR(32) NOT NULL DEFAULT '🔎', description TEXT NOT NULL, audience VARCHAR(255) NOT NULL,
    states_json JSON NOT NULL, education_json JSON NOT NULL, documents_json JSON NOT NULL, verify_json JSON NOT NULL,
    url VARCHAR(1000) NOT NULL, source VARCHAR(1000) NOT NULL, last_verified DATE NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE, sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_schemes_category_active (category, active), INDEX idx_schemes_active (active)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await pool.query(`CREATE TABLE IF NOT EXISTS search_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY, state VARCHAR(80) NOT NULL, education VARCHAR(40) NOT NULL,
    category VARCHAR(80) NOT NULL, query_text VARCHAR(100) NOT NULL DEFAULT '', result_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_search_created_at (created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  // First run: import the starter catalogue into SQL. Existing SQL edits are never overwritten.
  const [[countRow]] = await pool.query('SELECT COUNT(*) AS total FROM schemes');
  if (Number(countRow.total) === 0) {
    const dataPath = path.join(__dirname, 'data', 'accessbridge.json');
    const seed = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    for (let i = 0; i < seed.schemes.length; i++) {
      const s = seed.schemes[i];
      await pool.execute(`INSERT INTO schemes
        (id,name,category,icon,description,audience,states_json,education_json,documents_json,verify_json,url,source,last_verified,active,sort_order)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [s.id, s.name, s.category, s.icon || '🔎', s.description, s.audience,
        JSON.stringify(s.states || ['all']), JSON.stringify(s.education || []), JSON.stringify(s.documents || []), JSON.stringify(s.verify || []),
        s.url, s.source || s.url, s.lastVerified || null, s.active !== false, i]);
    }
    console.log(`Imported ${seed.schemes.length} starter resources into MySQL.`);
  }
}

async function initializeLocalStorage() {
  const catalogue = JSON.parse(await fs.promises.readFile(cataloguePath, 'utf8'));
  if (!Array.isArray(catalogue.schemes)) throw new Error('The local resource catalogue is invalid.');
  localSchemes = catalogue.schemes;
  try {
    const history = JSON.parse(await fs.promises.readFile(historyPath, 'utf8'));
    if (!Array.isArray(history)) throw new Error('The local search history is invalid.');
    localHistory = history;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    localHistory = [];
  }
}

function saveLocalHistory(entry) {
  historyWrite = historyWrite.catch(() => {}).then(async () => {
    const nextHistory = [{ ...entry, id: Date.now(), createdAt: new Date().toISOString() }, ...localHistory].slice(0, 500);
    await fs.promises.mkdir(dataDirectory, { recursive: true });
    await fs.promises.writeFile(historyPath, `${JSON.stringify(nextHistory, null, 2)}\n`, 'utf8');
    localHistory = nextHistory;
  });
  return historyWrite;
}

app.post('/api/assistant', async (req, res, next) => {
  try {
    const message = normalize(req.body.message, 500);
    const language = ['te', 'hi'].includes(req.body.language) ? req.body.language : 'en';
    if (!message) return res.status(400).json({ error: 'Please say or type what help you need.' });
    const text = ASSISTANT_TEXT[language];
    const ids = assistantIntent(message);
    const all = (await getSchemes()).filter(s => s.active !== false && isApprovedOfficialUrl(s.url) && isApprovedOfficialUrl(s.source || s.url));
    const byId = new Map(all.map(item => [item.id, item]));
    const results = ids.map(id => byId.get(id)).filter(Boolean).slice(0, 4).map(scheme => ({
      ...publicScheme(scheme),
      assistantDescription: text.descriptions[scheme.id] || scheme.description,
      sourceIsOfficialPortal: true,
      dataMode: 'official_portal_directory'
    }));
    const genericFallback = results.length === 2 && results.every(item => ['myscheme', 'india-gov'].includes(item.id)) && !ASSISTANT_INTENTS.some(intent => intent.terms.some(term => message.toLocaleLowerCase().includes(term)));
    res.json({
      reply: genericFallback ? text.none : text.found,
      results,
      followUp: text.followUp,
      language,
      dataMode: 'official_portal_directory',
      safetyNote: 'Searches the AccessBridge directory of allowlisted official portals. It does not retrieve or verify live scheme eligibility, benefit amounts, or deadlines.',
      conversationStored: false
    });
  } catch (error) { next(error); }
});

app.post('/api/speech', async (req, res, next) => {
  const voice = normalize(req.body?.voice, 80);
  const locale = speechVoices[voice];
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!locale || !text || text.length > 1200) {
    return res.status(400).json({ error: 'Choose a supported Hindi or Telugu voice and provide reply text up to 1,200 characters.' });
  }
  if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
    return res.status(503).json({ error: 'Hindi and Telugu neural speech needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in server/.env. The key is never sent to the browser.' });
  }
  if (!/^[a-z0-9]+$/i.test(process.env.AZURE_SPEECH_REGION)) {
    return res.status(500).json({ error: 'AZURE_SPEECH_REGION must be the Azure Speech resource region, such as centralindia.' });
  }
  if (isSpeechRateLimited(req.ip)) {
    return res.status(429).json({ error: 'Speech limit reached. Wait a minute before requesting more spoken replies.' });
  }
  const ssml = `<speak version="1.0" xml:lang="${locale}"><voice name="${voice}">${escapeXml(text)}</voice></speak>`;
  let response;
  try {
    response = await fetch(`https://${process.env.AZURE_SPEECH_REGION}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/ssml+xml',
        'Ocp-Apim-Subscription-Key': process.env.AZURE_SPEECH_KEY,
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3'
      },
      body: ssml,
      signal: AbortSignal.timeout(20_000)
    });
  } catch (error) {
    console.error('Azure Speech request failed:', error.name || 'network error');
    return res.status(502).json({ error: 'Could not reach Azure Speech. Check the server connection and Azure resource region.' });
  }
  if (!response.ok) {
    console.error(`Azure Speech returned HTTP ${response.status}.`);
    return res.status(502).json({ error: 'Azure Speech could not synthesize this reply. Check the Speech key, region, and Azure quota.' });
  }
  res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.send(Buffer.from(await response.arrayBuffer()));
});

app.get('/api/sources', async (req, res) => {
  const results = await getOfficialSourceStatuses(req.query.refresh === '1');
  res.json({ results, checkedAt: new Date().toISOString(), policy: 'Reachability checks only. A reachable portal does not prove each scheme detail is current or accurate.', officialSourceCount: OFFICIAL_SOURCES.length });
});
app.get('/api/health', async (_req, res, next) => {
  try {
    if (useMySql) await pool.query('SELECT 1');
    res.json({ ok: true, service: 'AccessBridge API', storage: storageName, timestamp: new Date().toISOString() });
  }
  catch (error) { next(error); }
});
app.get('/api/schemes', async (req, res, next) => {
  try {
    let schemes = (await getSchemes()).filter(s => s.active !== false && isApprovedOfficialUrl(s.url) && isApprovedOfficialUrl(s.source || s.url));
    const category = normalize(req.query.category, 80);
    const q = normalize(req.query.q, 100).toLowerCase();
    if (category && category !== 'All services') schemes = schemes.filter(s => s.category === category);
    if (q) schemes = schemes.filter(s => `${s.name} ${s.description} ${s.category} ${s.audience}`.toLowerCase().includes(q));
    res.json({ results: schemes.map(publicScheme), total: schemes.length, dataMode: 'official_portal_directory', note: 'Directory summaries are not live scheme rules. Confirm benefits, eligibility, documents and deadlines on the linked official portal.' });
  } catch (error) { next(error); }
});
app.post('/api/match', async (req, res, next) => {
  try {
    const state = normalize(req.body.state, 80);
    const education = normalize(req.body.education, 40);
    const category = normalize(req.body.category, 80) || 'All services';
    const query = normalize(req.body.query, 100);
    if (!state || !education) return res.status(400).json({ error: 'Please select a state and education level.' });
    let results = (await getSchemes()).filter(s => s.active !== false && isApprovedOfficialUrl(s.url) && isApprovedOfficialUrl(s.source || s.url));
    if (category !== 'All services') results = results.filter(s => s.category === category);
    if (query) results = results.filter(s => `${s.name} ${s.description} ${s.category} ${s.audience}`.toLowerCase().includes(query.toLowerCase()));
    const scored = results.map((scheme, originalIndex) => {
      let score = 0; const reasons = [];
      if (scheme.education?.includes(education)) { score += 3; reasons.push('Relevant to your education level'); }
      if (category !== 'All services' && scheme.category === category) { score += 5; reasons.push('Matches your selected category'); }
      return { scheme, score, reasons, originalIndex };
    }).sort((a, b) => b.score - a.score || a.originalIndex - b.originalIndex);
    const responseResults = scored.map(({ scheme, score, reasons }) => ({ ...publicScheme(scheme), matchScore: score, matchReasons: reasons.length ? reasons : ['General official service directory entry'], matchType: 'potential match' }));
    // Income is not collected or stored. No universal income cutoff is applied.
    if (useMySql) {
      await pool.execute('INSERT INTO search_history (state, education, category, query_text, result_count) VALUES (?,?,?,?,?)', [state, education, category, query, responseResults.length]);
      await pool.query('DELETE FROM search_history WHERE id NOT IN (SELECT id FROM (SELECT id FROM search_history ORDER BY id DESC LIMIT 500) AS recent_searches)');
    } else {
      await saveLocalHistory({ state, education, category, query, resultCount: responseResults.length });
    }
    res.json({ results: responseResults, total: responseResults.length, dataMode: 'official_portal_directory', personalization: { stateFilterApplied: false, message: 'State is recorded for context only. The current catalogue is national and does not claim verified state-specific matching.' }, note: 'These are potential matches, not eligibility decisions. Check scheme-specific criteria on the official provider website.' });
  } catch (error) { next(error); }
});
app.get('/api/history', async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || '20', 10) || 20));
    if (!useMySql) return res.json({ results: localHistory.slice(0, limit), totalStored: localHistory.length });
    const [rows] = await pool.execute('SELECT id,state,education,category,query_text AS query,result_count AS resultCount,created_at AS createdAt FROM search_history ORDER BY id DESC LIMIT ?', [limit]);
    res.json({ results: rows, totalStored: Number((await pool.query('SELECT COUNT(*) AS total FROM search_history'))[0][0].total) });
  } catch (error) { next(error); }
});
app.get('/api/stats', async (_req, res, next) => {
  try {
    if (!useMySql) return res.json({ schemeCount: localSchemes.filter(scheme => scheme.active !== false).length, searchesStored: localHistory.length, storage: storageName });
    const [[schemes]] = await pool.query('SELECT COUNT(*) AS total FROM schemes WHERE active = TRUE');
    const [[searches]] = await pool.query('SELECT COUNT(*) AS total FROM search_history');
    res.json({ schemeCount: Number(schemes.total), searchesStored: Number(searches.total), storage: storageName });
  } catch (error) { next(error); }
});
app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));
app.use((err, _req, res, _next) => {
  console.error(err.message || err);
  const dbUnavailable = ['ECONNREFUSED', 'ER_ACCESS_DENIED_ERROR', 'ER_BAD_DB_ERROR', 'ENOTFOUND'].includes(err.code);
  res.status(500).json({ error: dbUnavailable ? 'Database connection failed. Check MySQL is running and server/.env credentials are correct.' : 'Unexpected server error.' });
});

const initializeStorage = useMySql ? initializeDatabase : initializeLocalStorage;
initializeStorage().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AccessBridge API listening on port ${PORT}`);
    console.log(useMySql ? `MySQL storage: ${process.env.DB_NAME || 'accessbridge'} on ${process.env.DB_HOST || 'localhost'}` : `Local JSON storage: ${cataloguePath}`);
    console.log(`Official portal source registry: ${OFFICIAL_SOURCES.length} allowlisted links; status checks are reachability-only.`);
    if (isProduction && !allowedOrigins.length) console.warn('Set CORS_ORIGINS to the exact deployed frontend origin before production use.');
  });
}).catch(error => { console.error(`Could not initialize AccessBridge ${storageName} storage:`, error.message); process.exit(1); });
