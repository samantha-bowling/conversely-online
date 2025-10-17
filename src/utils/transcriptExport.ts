interface Message {
  id: string;
  sender: "me" | "other";
  text: string;
  timestamp: Date;
  fading?: boolean;
  remaining?: number;
  pending?: boolean;
}

/**
 * Generate a formatted chat transcript with metadata and ephemeral notice
 */
export function generateTranscript(
  messages: Message[],
  roomId: string,
  partnerName: string,
  sessionExpiry: string
): string {
  const now = new Date();
  const expiryDate = new Date(sessionExpiry);
  
  let transcript = '';
  
  // Header
  transcript += '==============================================\n';
  transcript += 'CONVERSELY CHAT TRANSCRIPT\n';
  transcript += '==============================================\n\n';
  
  // Ephemeral notice
  transcript += '⚠️  EPHEMERAL CONVERSATION NOTICE\n';
  transcript += `This conversation will be automatically deleted at: ${expiryDate.toLocaleString()}\n`;
  transcript += 'Data is only stored during your active session.\n\n';
  
  // Metadata
  transcript += `Chat ID: ${roomId}\n`;
  transcript += `Date: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}\n`;
  transcript += `Participants: You, ${partnerName}\n\n`;
  transcript += '----------------------------------------------\n\n';
  
  // Messages
  if (messages.length === 0) {
    transcript += '(No messages in this conversation)\n\n';
  } else {
    messages.forEach((msg) => {
      const timestamp = msg.timestamp.toLocaleTimeString();
      const sender = msg.sender === 'me' ? 'You' : partnerName;
      
      transcript += `[${timestamp}] ${sender}:\n`;
      transcript += `${msg.text}\n\n`;
    });
  }
  
  // Footer
  transcript += '----------------------------------------------\n';
  transcript += 'End of transcript\n';
  transcript += `Generated: ${now.toLocaleString()}\n`;
  transcript += '==============================================\n';
  
  return transcript;
}

/**
 * Trigger download of transcript as a .txt file
 */
export function downloadTranscript(content: string, filename?: string): void {
  const defaultFilename = `conversely-chat-${new Date().toISOString().split('T')[0]}.txt`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || defaultFilename;
  
  // Append to body, click, and remove (required for Firefox)
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Cleanup
  URL.revokeObjectURL(url);
}
