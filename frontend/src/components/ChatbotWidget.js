import { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ChatbotWidget() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let script = null;
    
    async function loadWidget() {
      try {
        const res = await axios.get(`${API_URL}/api/chatbot/config`);
        const { enabled, widget_key, api_url } = res.data;
        
        if (!enabled || !widget_key || loaded) return;
        
        // Inject the BanterBot widget script
        script = document.createElement('script');
        script.src = `${api_url}/widget/banterbot-widget.min.js`;
        script.setAttribute('data-widget-key', widget_key);
        script.setAttribute('data-api-url', api_url);
        script.async = true;
        document.body.appendChild(script);
        setLoaded(true);
      } catch (e) {
        // Silently fail — chatbot is optional
      }
    }
    
    loadWidget();
    
    return () => {
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [loaded]);

  return null;
}
