import React, { useState, useEffect } from 'react';
import { Play, Pause, RefreshCw, Volume2, Mic, Settings, AlertCircle, Sparkles, Check, Info, Users } from 'lucide-react';

// Initialize state-safe settings
const appId = typeof __app_id !== 'undefined' ? __app_id : 'gemini-tts-podcast';
const apiKey = ""; // Handled by the execution environment
in
export default function App() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBuffer, setAudioBuffer] = useState(null);
  const [audioSource, setAudioSource] = useState(null);
  const [audioContext, setAudioContext] = useState(null);

  // Dynamic Speaker Config
  const [speaker1Name, setSpeaker1Name] = useState('Nuntarat');
  const [speaker1Voice, setSpeaker1Voice] = useState('Whan');
  
  const [speaker2Name, setSpeaker2Name] = useState('Co-Host');
  const [speaker2Voice, setSpeaker2Voice] = useState('Nachon');

  // Podcast Script Settings
  const [prompt, setPrompt] = useState(
    "Generate a short transcript around 100 words that reads like it was clipped from a podcast by excited herpetologists. The host's name is Nuntarat Attasit."
  );
  const [transcript, setTranscript] = useState(
    "Nuntarat: Sawasdee krub! Look at this incredible specimen of the Siamese cat snake! It is absolutely gorgeous!\n" +
    "Co-Host: Oh wow, Nuntarat! The color banding on those scales is magnificent! Is it venomous?\n" +
    "Nuntarat: Mildly venomous, yes, but highly secretive! Finding one active in the rain forest canopy tonight is a massive win!"
  );

  const availableVoices = [
    { name: 'Whan', gender: 'Female', description: 'Expressive Thai/Global Voice' },
    { name: 'Nachon', gender: 'Male', description: 'Warm Thai/Global Voice' },
    { name: 'Kore', gender: 'Female', description: 'Clear and expressive English' },
    { name: 'Fenrir', gender: 'Male', description: 'Warm and deep English' },
    { name: 'Zephyr', gender: 'Neutral', description: 'Breezy and modern' },
    { name: 'Puck', gender: 'Neutral', description: 'Playful and bright' },
    { name: 'Charon', gender: 'Male', description: 'Steady and narrative' },
    { name: 'Leda', gender: 'Female', description: 'Crisp and professional' },
    { name: 'Orus', gender: 'Male', description: 'Authoritative' },
    { name: 'Aoede', gender: 'Female', description: 'Musical and lyrical' }
  ];

  // Helper: Convert Raw PCM 16-bit to WAV
  const convertPCMToWAV = (pcmBase64, sampleRate = 24000) => {
    const binaryString = window.atob(pcmBase64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const buffer = bytes.buffer;
    const wavBuffer = new ArrayBuffer(44 + buffer.byteLength);
    const view = new DataView(wavBuffer);

    /* RIFF identifier */
    writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 36 + buffer.byteLength, true);
    /* RIFF type */
    writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw) */
    view.setUint16(20, 1, true);
    /* channel count */
    view.setUint16(22, 1, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, sampleRate * 2, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, 2, true);
    /* bits per sample */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, buffer.byteLength, true);

    // Write PCM audio samples
    const pcmView = new DataView(buffer);
    for (let i = 0; i < buffer.byteLength; i++) {
      view.setUint8(44 + i, pcmView.getUint8(i));
    }

    return new Blob([wavBuffer], { type: 'audio/wav' });
  };

  const writeString = (view, offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // Exponential backoff runner for API reliability
  const apiCallWithRetry = async (url, payload, retries = 5, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (response.ok) return await response.json();
      } catch (e) {
        if (i === retries - 1) throw e;
      }
      await new Promise(res => setTimeout(res, delay * Math.pow(2, i)));
    }
    throw new Error("Failed to complete request after retries");
  };

  // Generate Transcript using Gemini 2.5 Flash
  const generateTranscript = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: {
          parts: [{
            text: `You are a creative writer. Generate only the transcript requested. Format speaker lines exactly as: '${speaker1Name}: [dialogue]' and '${speaker2Name}: [dialogue]' on new lines.`
          }]
        }
      };

      const result = await apiCallWithRetry(url, payload);
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        setTranscript(text.trim());
      } else {
        throw new Error("Empty transcript returned.");
      }
    } catch (err) {
      setError("Failed to generate transcript. Please check your network or try again.");
    } finally {
      setLoading(false);
    }
  };

  // Generate Multi-Speaker Podcast Audio
  const generatePodcastAudio = async () => {
    setLoading(true);
    setError(null);
    stopAudio();

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`;
      
      // Build dynamic speech config based on user's defined speakers and selected voices
      const speakerVoiceConfigs = [];
      if (speaker1Name.trim()) {
        speakerVoiceConfigs.push({
          speaker: speaker1Name.trim(),
          voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker1Voice } }
        });
      }
      if (speaker2Name.trim()) {
        speakerVoiceConfigs.push({
          speaker: speaker2Name.trim(),
          voiceConfig: { prebuiltVoiceConfig: { voiceName: speaker2Voice } }
        });
      }

      const payload = {
        contents: [{ parts: [{ text: transcript }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              multiSpeakerVoiceConfig: {
                speakerVoiceConfigs: speakerVoiceConfigs
              }
            }
          }
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error("TTS Generation request failed. Ensure speaker names in your configuration match exactly with the speaker names in the transcript.");
      }

      const result = await response.json();
      const inlineData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData;

      if (!inlineData || !inlineData.data) {
        throw new Error("Audio data is missing from the Gemini response.");
      }

      // Convert raw PCM to browser-playable WAV
      const wavBlob = convertPCMToWAV(inlineData.data, 24000);
      const urlObject = URL.createObjectURL(wavBlob);
      setAudioUrl(urlObject);

      // Decode WAV into local AudioBuffer
      const arrayBuffer = await wavBlob.arrayBuffer();
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
      setAudioContext(ctx);
      setAudioBuffer(decodedBuffer);

    } catch (err) {
      setError(err.message || "An error occurred during TTS audio generation.");
    } finally {
      setLoading(false);
    }
  };

  // Audio Playback Controls
  const playAudio = () => {
    if (!audioBuffer) return;

    const ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)();
    if (!audioContext) setAudioContext(ctx);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    
    source.onended = () => {
      setIsPlaying(false);
    };

    source.start(0);
    setAudioSource(source);
    setIsPlaying(true);
  };

  const stopAudio = () => {
    if (audioSource) {
      try {
        audioSource.stop();
      } catch (e) {}
      setAudioSource(null);
    }
    setIsPlaying(false);
  };

  const togglePlayback = () => {
    if (isPlaying) {
      stopAudio();
    } else {
      playAudio();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-500/20">
              <Mic className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Gemini Podcast Studio</h1>
              <p className="text-xs text-slate-400">Multi-Speaker Dialogue Synthesizer & Voice Sandbox</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-xs bg-slate-800/80 px-3 py-1.5 rounded-lg text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Gemini TTS Engine Active</span>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-5xl w-full mx-auto p-4 md:p-6 flex-grow grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Left Side: Writing and Prompts */}
        <div className="md:col-span-2 space-y-6">
          {/* Transcript Generator Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-indigo-400" />
                <h2 className="text-base font-semibold">1. Podcast Prompt Setup</h2>
              </div>
              <button
                onClick={generateTranscript}
                disabled={loading}
                className="text-xs bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
              >
                <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
                AI Generate Script
              </button>
            </div>
            
            <textarea
              className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              placeholder="What should they talk about?"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          {/* Transcript Live Editing Block */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col h-[320px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Settings className="h-5 w-5 text-emerald-400" />
                <h2 className="text-base font-semibold">2. Live Script Editor</h2>
              </div>
              <span className="text-xs text-slate-500">Must match the Speaker Names in config</span>
            </div>

            <textarea
              className="w-full flex-grow bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm font-mono text-indigo-200 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Speaker1: Dialogue here...\nSpeaker2: Dialogue here..."
            />
          </div>
        </div>

        {/* Right Side: Cast / Speakers Configuration and Audio Playback */}
        <div className="space-y-6">
          {/* Casting and Speaker config */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-400" />
              Podcast Cast Settings
            </h2>

            {/* Speaker 1 */}
            <div className="space-y-2 border-b border-slate-800 pb-3">
              <div className="flex gap-2">
                <div className="w-1/2">
                  <label className="text-xs text-slate-400 block font-medium mb-1">Speaker 1 Name</label>
                  <input
                    type="text"
                    value={speaker1Name}
                    onChange={(e) => setSpeaker1Name(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-semibold"
                  />
                </div>
                <div className="w-1/2">
                  <label className="text-xs text-slate-400 block font-medium mb-1">Assigned Voice</label>
                  <select
                    value={speaker1Voice}
                    onChange={(e) => setSpeaker1Voice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200"
                  >
                    {availableVoices.map((v) => (
                      <option key={`sp1-${v.name}`} value={v.name}>{v.name} ({v.gender})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Speaker 2 */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="w-1/2">
                  <label className="text-xs text-slate-400 block font-medium mb-1">Speaker 2 Name</label>
                  <input
                    type="text"
                    value={speaker2Name}
                    onChange={(e) => setSpeaker2Name(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-semibold"
                  />
                </div>
                <div className="w-1/2">
                  <label className="text-xs text-slate-400 block font-medium mb-1">Assigned Voice</label>
                  <select
                    value={speaker2Voice}
                    onChange={(e) => setSpeaker2Voice(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200"
                  >
                    {availableVoices.map((v) => (
                      <option key={`sp2-${v.name}`} value={v.name}>{v.name} ({v.gender})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Action Render and Audio Output Block */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl flex flex-col justify-between">
            <div className="space-y-2">
              <h2 className="text-base font-semibold">3. Audio Renderer</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Render the dialogue into a high-fidelity multi-speaker WAV file using Gemini's Native Voice Engine.
              </p>
            </div>

            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex gap-2.5 items-start text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={generatePodcastAudio}
              disabled={loading || !transcript.trim()}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:opacity-40 py-3 rounded-xl font-medium text-sm transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Generating WAV PCM...
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4" />
                  Render Audio Clip
                </>
              )}
            </button>

            {/* Audio Wave Player widget */}
            {audioBuffer && (
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Audio Preview Ready</span>
                  <span className="text-xs font-mono text-emerald-400">WAV PCM16 24kHz</span>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlayback}
                    className="p-3 bg-indigo-500/20 border border-indigo-500/30 hover:bg-indigo-500/30 text-indigo-200 rounded-full transition-all"
                  >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>
                  <div className="flex-grow">
                    <div className="h-1.5 bg-slate-950 rounded-full overflow-hidden relative">
                      <div className={`h-full bg-indigo-500 transition-all duration-300 ${isPlaying ? 'w-full' : 'w-0'}`} />
                    </div>
                  </div>
                </div>

                {audioUrl && (
                  <a
                    href={audioUrl}
                    download="podcast-clip.wav"
                    className="block text-center text-xs text-slate-400 hover:text-slate-200 underline mt-2"
                  >
                    Download rendered WAV file
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer Info */}
      <footer className="border-t border-slate-900 bg-slate-950 px-6 py-4 mt-auto">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 gap-2">
          <span>Developed using Gemini 2.5 Audio Engine.</span>
          <span className="flex items-center gap-1">
            <Info className="h-3 w-3" /> Note: Ensure the Speaker Name labels match the prefix labels in the script exactly (case sensitive).
          </span>
        </div>
      </footer>
    </div>
  );
}

