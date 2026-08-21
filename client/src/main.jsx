import 'bootstrap/dist/css/bootstrap.min.css';
import './styles.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { FeedbackProvider, useFeedback } from './context/FeedbackContext.jsx';
import FeedbackViewport from './components/common/FeedbackViewport.jsx';

function FeedbackLayer() {
  const { items, dismiss } = useFeedback();
  return <FeedbackViewport items={items} onDismiss={dismiss} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <FeedbackProvider>
        <App />
        <FeedbackLayer />
      </FeedbackProvider>
    </AuthProvider>
  </React.StrictMode>
);
