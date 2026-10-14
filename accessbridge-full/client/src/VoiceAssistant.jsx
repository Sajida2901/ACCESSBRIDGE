import { useEffect, useRef, useState } from 'react';
import { Bot, ExternalLink, Headphones, MessageCircle, Mic, MicOff, Send, ShieldCheck, Volume2, VolumeX, X } from 'lucide-react';
import './VoiceAssistant.css';

const LANG = {
  English: { code: 'en-IN', short: 'English (India)', voiceLabel: 'Speaking voice', voiceUnavailable: 'No speech voice for this language is installed in your browser or operating system. You can still read the reply or type your question.', title: 'Talk to AccessBridge', subtitle: 'Speak naturally. I will help you find official starting points.', intro: 'Hello! Tell me what help you need. You can type or use the microphone.', placeholder: 'For example: I need help with education fees…', send: 'Send', listen: 'Speak', stop: 'Stop listening', listening: 'Listening…', thinking: 'Checking the official-resource directory…', micUnsupported: 'Voice input is not supported in this browser. Try Chrome, or type your question.', micDenied: 'Microphone access was blocked. Allow microphone access in your browser settings, or type your question.', speechUnsupported: 'Speech playback is not available in this browser.', clear: 'Clear conversation', source: 'Official portal', disclaimer: 'I only search the AccessBridge directory of official portals. I do not make eligibility decisions or invent benefits, deadlines, or requirements. Open the source to confirm current details.', noMatch: 'I could not find a close match in the current directory. Try asking about scholarships, education loans, jobs, Aadhaar, digital documents, or government schemes.', matched: 'I found these official starting points that may help. Their listing is not confirmation that you qualify.', powered: 'Directory-based assistant · No microphone audio is stored by AccessBridge.' },
  తెలుగు: { code: 'te-IN', short: 'తెలుగు', voiceLabel: 'మాట్లాడే స్వరం', voiceUnavailable: 'మీ బ్రౌజర్ లేదా ఆపరేటింగ్ సిస్టమ్‌లో ఈ భాషకు మాటల స్వరం ఇన్‌స్టాల్ చేయబడలేదు. సమాధానాన్ని చదవవచ్చు లేదా టైప్ చేయవచ్చు.', title: 'AccessBridge తో మాట్లాడండి', subtitle: 'మీకు సహాయం కావాల్సిన విషయాన్ని మీ మాటల్లో చెప్పండి.', intro: 'నమస్కారం! మీకు ఏ సహాయం కావాలో చెప్పండి. టైప్ చేయవచ్చు లేదా మైక్రోఫోన్ ఉపయోగించవచ్చు.', placeholder: 'ఉదా: చదువు ఫీజుల కోసం సహాయం కావాలి…', send: 'పంపండి', listen: 'మాట్లాడండి', stop: 'వినడం ఆపండి', listening: 'వింటున్నాం…', thinking: 'అధికారిక వనరులను వెతుకుతున్నాం…', micUnsupported: 'ఈ బ్రౌజర్‌లో వాయిస్ ఇన్‌పుట్ అందుబాటులో లేదు. Chrome ప్రయత్నించండి లేదా టైప్ చేయండి.', micDenied: 'మైక్రోఫోన్ అనుమతి లేదు. బ్రౌజర్ సెట్టింగ్స్‌లో అనుమతించండి లేదా టైప్ చేయండి.', speechUnsupported: 'ఈ బ్రౌజర్‌లో మాటల రూపంలో సమాధానం చెప్పడం అందుబాటులో లేదు.', clear: 'సంభాషణ తొలగించండి', source: 'అధికారిక పోర్టల్', disclaimer: 'నేను AccessBridge లోని అధికారిక పోర్టల్‌ల జాబితాను మాత్రమే వెతుకుతాను. అర్హతను నిర్ణయించను; ప్రయోజనాలు, తేదీలు లేదా నియమాలను కల్పించను. తాజా వివరాల కోసం అధికారిక మూలాన్ని తెరవండి.', noMatch: 'ప్రస్తుత జాబితాలో సరిపోయే వనరు కనబడలేదు. స్కాలర్‌షిప్‌లు, చదువు రుణాలు, ఉద్యోగాలు, ఆధార్, డిజిటల్ పత్రాలు లేదా ప్రభుత్వ పథకాల గురించి అడగండి.', matched: 'మీకు ఉపయోగపడే కొన్ని అధికారిక ప్రారంభ వనరులు కనుగొన్నాను. ఇవి చూపించడం అర్హత నిర్ధారణ కాదు.', powered: 'అధికారిక పోర్టల్‌ల జాబితా ఆధారిత సహాయకుడు · మీ మైక్రోఫోన్ ఆడియోను AccessBridge నిల్వ చేయదు.' },
  हिन्दी: { code: 'hi-IN', short: 'हिन्दी', voiceLabel: 'बोलने की आवाज़', voiceUnavailable: 'आपके ब्राउज़र या ऑपरेटिंग सिस्टम में इस भाषा की आवाज़ इंस्टॉल नहीं है। आप जवाब पढ़ सकते हैं या अपना सवाल लिख सकते हैं।', title: 'AccessBridge से बात करें', subtitle: 'आप अपनी ज़रूरत अपनी भाषा में बता सकते हैं।', intro: 'नमस्ते! बताइए आपको किस मदद की ज़रूरत है। आप लिख सकते हैं या माइक्रोफ़ोन का उपयोग कर सकते हैं।', placeholder: 'उदाहरण: पढ़ाई की फीस के लिए मदद चाहिए…', send: 'भेजें', listen: 'बोलें', stop: 'सुनना बंद करें', listening: 'सुन रहे हैं…', thinking: 'आधिकारिक संसाधन खोज रहे हैं…', micUnsupported: 'इस ब्राउज़र में आवाज़ से लिखना उपलब्ध नहीं है। Chrome आज़माएँ या अपना सवाल लिखें।', micDenied: 'माइक्रोफ़ोन की अनुमति नहीं मिली। ब्राउज़र सेटिंग में अनुमति दें या सवाल लिखें।', speechUnsupported: 'इस ब्राउज़र में आवाज़ में जवाब देना उपलब्ध नहीं है।', clear: 'बातचीत मिटाएँ', source: 'आधिकारिक पोर्टल', disclaimer: 'मैं केवल AccessBridge की आधिकारिक पोर्टल सूची खोजता हूँ। मैं पात्रता तय नहीं करता और लाभ, तारीख़ या नियम नहीं गढ़ता। ताज़ा जानकारी के लिए आधिकारिक स्रोत खोलें।', noMatch: 'मौजूदा सूची में उपयुक्त स्रोत नहीं मिला। छात्रवृत्ति, शिक्षा ऋण, नौकरी, आधार, डिजिटल दस्तावेज़ या सरकारी योजनाओं के बारे में पूछें।', matched: 'मुझे कुछ आधिकारिक शुरुआती स्रोत मिले हैं जो मदद कर सकते हैं। सूची में होना पात्रता की पुष्टि नहीं है।', powered: 'आधिकारिक पोर्टल सूची पर आधारित सहायक · AccessBridge आपकी माइक्रोफ़ोन रिकॉर्डिंग सहेजता नहीं है।' }
};
const AZURE_VOICES = {
  తెలుగు: [
    { id: 'te-IN-ShrutiNeural', name: 'Shruti · Telugu neural voice' },
    { id: 'te-IN-MohanNeural', name: 'Mohan · Telugu neural voice' }
  ],
  हिन्दी: [
    { id: 'hi-IN-SwaraNeural', name: 'Swara · Hindi neural voice' },
    { id: 'hi-IN-MadhurNeural', name: 'Madhur · Hindi neural voice' }
  ]
};

export default function VoiceAssistant({ api, language = 'English' }) {
  const t = LANG[language] || LANG.English;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState([]);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [speakReplies, setSpeakReplies] = useState(true);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const listRef = useRef(null);
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const audioRef = useRef(null);
  const localVoices = availableVoices.filter(voice => voice.lang.toLowerCase().startsWith(t.code.slice(0, 2).toLowerCase()));
  const cloudVoices = AZURE_VOICES[language] || [];
  const voiceOptions = [...cloudVoices.map(voice => ({ ...voice, provider: 'azure' })), ...localVoices.map(voice => ({ id: voice.voiceURI, name: voice.name, provider: 'browser', voice }))];
  const preferredVoice = voiceOptions.find(voice => voice.id === selectedVoiceURI)
    || voiceOptions.find(voice => voice.provider === 'azure')
    || voiceOptions.find(voice => voice.provider === 'browser' && voice.voice.lang.toLowerCase() === t.code.toLowerCase())
    || voiceOptions.find(voice => voice.provider === 'browser');

  useEffect(() => {
    if (messages.length === 0) setMessages([{ role: 'assistant', text: t.intro, results: [] }]);
    else setMessages(old => old.map((m, i) => i === 0 && m.role === 'assistant' ? { ...m, text: t.intro } : m));
    // Keep the conversation, but localize the welcome message when language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);
  useEffect(() => {
    if (!('speechSynthesis' in window)) return undefined;
    const updateVoices = () => setAvailableVoices(window.speechSynthesis.getVoices());
    updateVoices();
    window.speechSynthesis.addEventListener('voiceschanged', updateVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', updateVoices);
  }, []);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages, busy, open]);
  useEffect(() => () => { try { recognitionRef.current?.stop(); } catch {} if ('speechSynthesis' in window) window.speechSynthesis.cancel(); if (audioRef.current) { audioRef.current.audio.pause(); URL.revokeObjectURL(audioRef.current.url); } }, []);

  function stopCloudSpeech() {
    if (!audioRef.current) return;
    audioRef.current.audio.pause();
    URL.revokeObjectURL(audioRef.current.url);
    audioRef.current = null;
  }

  async function say(text) {
    if (!speakReplies) return;
    if (preferredVoice?.provider === 'azure') {
      stopCloudSpeech();
      try {
        const audioBlob = await api('/api/speech', { method: 'POST', body: JSON.stringify({ text, voice: preferredVoice.id }) });
        const url = URL.createObjectURL(audioBlob);
        const audio = new Audio(url);
        audioRef.current = { audio, url };
        audio.onended = () => { if (audioRef.current?.audio === audio) stopCloudSpeech(); };
        audio.onerror = () => { if (audioRef.current?.audio === audio) stopCloudSpeech(); setError('Could not play the Azure speech audio. Try again or read the reply.'); };
        await audio.play();
      } catch (error) {
        const setupNeeded = error.message.startsWith('Hindi and Telugu neural speech needs AZURE_SPEECH_KEY');
        setError(setupNeeded && language === 'తెలుగు'
          ? 'తెలుగు, హిందీ neural voice కోసం server/.envలో AZURE_SPEECH_KEY, AZURE_SPEECH_REGION అమర్చండి.'
          : setupNeeded && language === 'हिन्दी'
            ? 'हिंदी और तेलुगु neural आवाज़ के लिए server/.env में AZURE_SPEECH_KEY और AZURE_SPEECH_REGION सेट करें।'
            : error.message);
      }
      return;
    }
    if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) { setError(t.speechUnsupported); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = t.code;
    utterance.rate = 0.92;
    if (!preferredVoice) { setError(t.voiceUnavailable); return; }
    if (!preferredVoice) { setError(t.voiceUnavailable); return; }
    utterance.voice = preferredVoice.voice;
    window.speechSynthesis.speak(utterance);
  }

  function startListening() {
    setError('');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { setError(t.micUnsupported); return; }
    try { recognitionRef.current?.stop(); } catch {}
    finalTranscriptRef.current = '';
    const recognition = new SpeechRecognition();
    recognition.lang = t.code;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 3;
    recognition.onstart = () => setListening(true);
    recognition.onresult = event => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        transcript += `${result[0].transcript} `;
      }
      finalTranscriptRef.current = Array.from(event.results).filter(result => result.isFinal).map(result => result[0].transcript).join(' ');
      setDraft(transcript.trim());
    };
    recognition.onerror = event => { setListening(false); if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setError(t.micDenied); else if (event.error !== 'no-speech' && event.error !== 'aborted') setError(`Voice input: ${event.error}. You can type instead.`); };
    recognition.onend = () => {
      setListening(false);
      const spokenMessage = finalTranscriptRef.current.trim();
      finalTranscriptRef.current = '';
      if (spokenMessage) sendMessage(undefined, spokenMessage);
    };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch { setListening(false); setError(t.micUnsupported); }
  }

  async function sendMessage(event, spokenMessage) {
    event?.preventDefault();
    const message = (spokenMessage || draft).trim();
    if (!message || busy) return;
    setError(''); setDraft(''); setMessages(old => [...old, { role: 'user', text: message, results: [] }]); setBusy(true);
    try {
      const data = await api('/api/assistant', { method: 'POST', body: JSON.stringify({ message, language: language === 'తెలుగు' ? 'te' : language === 'हिन्दी' ? 'hi' : 'en' }) });
      const assistantMessage = { role: 'assistant', text: data.reply, results: data.results || [], followUp: data.followUp || '' };
      setMessages(old => [...old, assistantMessage]);
      const spoken = [data.reply, ...(data.results || []).slice(0, 3).map(item => `${item.name}. ${item.assistantDescription || item.description}`)].join(' ');
      await say(spoken);
    } catch (e) {
      const fallback = t.noMatch;
      setMessages(old => [...old, { role: 'assistant', text: fallback, results: [] }]);
      setError(`Could not connect to the AccessBridge assistant. ${e.message}`);
    } finally { setBusy(false); }
  }

  function clearConversation() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    stopCloudSpeech();
    finalTranscriptRef.current = '';
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false); setError(''); setDraft(''); setMessages([{ role: 'assistant', text: t.intro, results: [] }]);
  }

  return <>
    <button className={`voice-launcher ${open ? 'voice-launcher-open' : ''}`} onClick={() => setOpen(v => !v)} aria-label={open ? 'Close voice assistant' : 'Open voice assistant'} aria-expanded={open}>
      {open ? <X size={21}/> : <MessageCircle size={21}/>}<span>{open ? 'Close' : 'Talk to us'}</span>
    </button>
    {open && <section className="voice-panel" aria-label={t.title}>
      <header className="voice-header"><span className="voice-avatar"><Bot size={21}/></span><span className="voice-headings"><b>{t.title}</b><small>{t.subtitle}</small></span><button className="voice-icon-btn" onClick={() => setOpen(false)} aria-label="Close assistant"><X size={18}/></button></header>
      <div className="voice-language-row"><span><Headphones size={14}/> {t.short}</span>{voiceOptions.length > 0 && <label className="voice-choice"><span>{t.voiceLabel}</span><select aria-label={t.voiceLabel} value={preferredVoice?.id || ''} onChange={event => setSelectedVoiceURI(event.target.value)}>{voiceOptions.map(voice => <option key={voice.id} value={voice.id}>{voice.name}</option>)}</select></label>}<button onClick={() => { setSpeakReplies(v => !v); if (speakReplies && 'speechSynthesis' in window) window.speechSynthesis.cancel(); stopCloudSpeech(); }} title={speakReplies ? 'Mute spoken replies' : 'Enable spoken replies'}>{speakReplies ? <Volume2 size={15}/> : <VolumeX size={15}/>} {speakReplies ? 'Voice on' : 'Voice off'}</button></div>
      <div className="voice-messages" ref={listRef} aria-live="polite">{messages.map((m, i) => <div className={`voice-message-row ${m.role}`} key={`${i}-${m.role}`}><span className="voice-message-avatar">{m.role === 'assistant' ? <Bot size={15}/> : <span>YOU</span>}</span><div className="voice-message-content"><div className="voice-bubble">{m.text}</div>{m.results?.length > 0 && <div className="voice-results">{m.results.map(item => <article className="voice-result" key={item.id}><b>{item.name}</b><p>{item.assistantDescription || item.description}</p><small><ShieldCheck size={12}/> {t.source}</small><a href={item.url} target="_blank" rel="noopener noreferrer">Open official website <ExternalLink size={12}/></a></article>)}</div>}</div></div>)}{busy && <div className="voice-working"><span className="voice-dots"><i/><i/><i/></span>{t.thinking}</div>}</div>
      <div className="voice-disclaimer"><ShieldCheck size={14}/><span>{t.disclaimer}</span></div>
      {error && <div className="voice-error" role="status">{error}</div>}
      <form className="voice-compose" onSubmit={sendMessage}><button type="button" className={`voice-mic ${listening ? 'listening' : ''}`} disabled={busy} onClick={listening ? () => recognitionRef.current?.stop() : startListening} aria-label={listening ? t.stop : t.listen} title={listening ? t.stop : t.listen}>{listening ? <MicOff size={19}/> : <Mic size={19}/>}</button><input value={draft} onChange={e => setDraft(e.target.value)} placeholder={listening ? t.listening : t.placeholder} aria-label="Message AccessBridge" maxLength={500}/><button type="submit" className="voice-send" disabled={!draft.trim() || busy} aria-label={t.send}><Send size={17}/></button></form>
      <div className="voice-bottom"><span>{t.powered}<span className="voice-privacy-note">{language === 'తెలుగు' ? 'బ్రౌజర్ మాటల గుర్తింపును ప్రాసెస్ చేయవచ్చు; Azure సమాధానాన్ని మాటగా చెబుతుంది.' : language === 'हिन्दी' ? 'ब्राउज़र बोलने की पहचान प्रोसेस कर सकता है; Azure जवाब को आवाज़ देता है।' : 'Your browser may process speech recognition; Azure voices the reply.'}</span></span><button onClick={clearConversation}>{t.clear}</button></div>
    </section>}
  </>;
}
