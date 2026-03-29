import { useState, useCallback } from 'react';
import { ChatbotList } from './ChatbotList';
import { ChatbotCreate } from './ChatbotCreate';
import { ChatbotSettings } from './ChatbotSettings';
import type { ChatbotConfig } from '../../api/chatbot';

type View =
  | { type: 'list' }
  | { type: 'create' }
  | { type: 'settings'; chatbotId: string };

export function ChatbotIndex() {
  const [view, setView] = useState<View>({ type: 'list' });

  const handleCreateNew = useCallback(() => {
    setView({ type: 'create' });
  }, []);

  const handleSelectChatbot = useCallback((chatbot: ChatbotConfig) => {
    setView({ type: 'settings', chatbotId: chatbot.id });
  }, []);

  const handleCreated = useCallback((chatbot: ChatbotConfig) => {
    setView({ type: 'settings', chatbotId: chatbot.id });
  }, []);

  const handleBackToList = useCallback(() => {
    setView({ type: 'list' });
  }, []);

  switch (view.type) {
    case 'list':
      return (
        <ChatbotList
          onCreateNew={handleCreateNew}
          onSelect={handleSelectChatbot}
        />
      );
    case 'create':
      return (
        <ChatbotCreate
          onBack={handleBackToList}
          onCreated={handleCreated}
        />
      );
    case 'settings':
      return (
        <ChatbotSettings
          chatbotId={view.chatbotId}
          onBack={handleBackToList}
          onDeleted={handleBackToList}
        />
      );
  }
}
