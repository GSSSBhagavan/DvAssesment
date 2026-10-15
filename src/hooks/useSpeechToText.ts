import { useState, useEffect, useCallback, useRef } from 'react';

export const useSpeechToText = () => {
  const [isListening, setIsListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognitionConstructor = 
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognitionConstructor) {
        setIsSupported(true);
        const rec = new SpeechRecognitionConstructor();
        rec.continuous = true;
        rec.interimResults = true;
        
        rec.onresult = (event: any) => {
          let interim = '';
          let final = '';

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              final += event.results[i][0].transcript;
            } else {
              interim += event.results[i][0].transcript;
            }
          }

          if (final) {
            setFinalTranscript(prev => (prev + ' ' + final).trim());
          }
          setInterimTranscript(interim);
        };

        rec.onerror = (event: any) => {
          console.error("Speech recognition error", event.error);
          if (event.error !== 'no-speech') {
             setError(`Microphone error: ${event.error}.`);
             setIsListening(false);
          }
        };
        
        rec.onend = () => {
          // If we manually stopped it, isListening will be false soon, 
          // but if it stopped unexpectedly, we should set it.
          setIsListening(false);
        };

        recognitionRef.current = rec;
      } else {
        setIsSupported(false);
        setError('Your browser does not support Speech Recognition.');
      }
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = useCallback(async () => {
    setError('');
    setInterimTranscript('');
    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsListening(true);
        } catch (e) {
          // Sometimes calling start() when already started throws
          setIsListening(true);
        }
      }
    } catch (err) {
      setError('Could not start speech recognition.');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch(e) {}
      setIsListening(false);
      // Flush interim to final when stopped manually
      setFinalTranscript(prev => {
        setInterimTranscript('');
        return (prev + ' ' + interimTranscript).trim();
      });
    }
  }, [interimTranscript]);

  const resetTranscript = useCallback(() => {
    setFinalTranscript('');
    setInterimTranscript('');
  }, []);

  return { 
    isListening, 
    finalTranscript, 
    interimTranscript, 
    error, 
    isSupported,
    startListening, 
    stopListening, 
    resetTranscript,
    setFinalTranscript
  };
};
