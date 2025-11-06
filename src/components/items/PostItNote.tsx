import { Textarea } from '../ui/textarea';
import type { User } from '../types';
import { useState, useMemo } from 'react';

interface PostItNoteProps {
  content: { text: string };
  color?: string;
  onChange: (content: { text: string }) => void;
  isEditMode: boolean;
  users: User[];
}

const postitTextures = [
  '/assets/images/postit/4078c9f7-701f-4168-aee3-4c54c27ef2c2_rw_1920.png',
  '/assets/images/postit/5ab0aced-d15c-4bce-b8ae-8b2e4793c5ea_rw_1200.png',
  '/assets/images/postit/630a0f6a-6b8a-4568-90f0-dbd89a95fe85_rw_1920.png',
  '/assets/images/postit/87bc023a-e791-4e51-b9b5-6c2b0f275124_rw_1200.png',
  '/assets/images/postit/ab34d321-2df4-4fa4-bf9a-e9f47ff4a84c_rw_1920.png',
  '/assets/images/postit/b4936d03-4fb1-4a53-bbdd-90fd17025634_rw_1200.png',
  '/assets/images/postit/e285b20d-1c5d-46fe-933d-85597cc6a3af_rw_1200.png',
  '/assets/images/postit/ef037e7f-a4e6-4708-98ed-7028ab691758_rw_1920.png',
];

export function PostItNote({ content, color = '#fef3c7', onChange, isEditMode, users }: PostItNoteProps) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  
  // Select a random texture once and keep it consistent
  const texture = useMemo(() => 
    postitTextures[Math.floor(Math.random() * postitTextures.length)],
    []
  );

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    const cursorPos = e.target.selectionStart;
    setCursorPosition(cursorPos);
    
    // Check if user is typing @
    const textBeforeCursor = newText.slice(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
      if (!textAfterAt.includes(' ') && textAfterAt.length < 20) {
        setMentionSearch(textAfterAt);
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
    
    onChange({ text: newText });
  };

  const insertMention = (user: User) => {
    const textBeforeCursor = content.text.slice(0, cursorPosition);
    const textAfterCursor = content.text.slice(cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');
    
    const newText = 
      content.text.slice(0, lastAtIndex) + 
      `@${user.twitterHandle || user.name} ` + 
      textAfterCursor;
    
    onChange({ text: newText });
    setShowMentions(false);
  };

  const filteredUsers = users.filter(user => 
    (user.twitterHandle?.toLowerCase().includes(mentionSearch.toLowerCase()) ||
     user.name.toLowerCase().includes(mentionSearch.toLowerCase()))
  );

  // Render text with highlighted mentions
  const renderTextWithMentions = (text: string) => {
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        const handle = part.slice(1);
        const user = users.find(u => u.twitterHandle === handle || u.name === handle);
        if (user) {
          return (
            <span 
              key={i}
              className="inline-flex items-center gap-1 bg-blue-100 px-1 rounded"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {user.profilePic && (
                <img 
                  src={user.profilePic} 
                  alt={user.name}
                  className="w-4 h-4 rounded-full inline"
                />
              )}
              {part}
            </span>
          );
        }
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div
      className="w-64 h-64 p-6 shadow-lg relative"
      style={{
        backgroundColor: color,
        boxShadow: `
          4px 4px 12px rgba(0,0,0,0.3), 
          0 8px 20px rgba(0,0,0,0.2),
          inset 0 1px 0 rgba(255,255,255,0.5),
          inset 0 -1px 0 rgba(0,0,0,0.05)
        `,
      }}
    >
      {/* Post-it texture overlay */}
      <div 
        className="absolute inset-0 opacity-[0.25] pointer-events-none"
        style={{
          backgroundImage: `url(${texture})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          mixBlendMode: 'multiply',
        }}
      />
      
      {isEditMode ? (
        <div className="relative h-full">
          <Textarea
            value={content.text}
            onChange={handleTextChange}
            placeholder="Write a note..."
            className="w-full h-full bg-transparent border-none resize-none focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
            style={{ 
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
              lineHeight: '1.6',
              color: '#1f2937'
            }}
          />
          
          {/* Mention dropdown */}
          {showMentions && filteredUsers.length > 0 && (
            <div 
              className="absolute bottom-full left-0 mb-2 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50"
              style={{ minWidth: '200px' }}
            >
              {filteredUsers.slice(0, 5).map(user => (
                <button
                  key={user.id}
                  onClick={() => insertMention(user)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 text-left"
                >
                  {user.profilePic ? (
                    <img 
                      src={user.profilePic} 
                      alt={user.name}
                      className="w-6 h-6 rounded-full"
                    />
                  ) : (
                    <div 
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white"
                      style={{ backgroundColor: user.color }}
                    >
                      {user.name.charAt(0)}
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm">{user.name}</span>
                    {user.twitterHandle && (
                      <span className="text-xs text-gray-500">@{user.twitterHandle}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div 
          className="w-full h-full whitespace-pre-wrap break-words"
          style={{ 
            fontFamily: 'Inter, sans-serif',
            fontSize: '14px',
            lineHeight: '1.6',
            color: '#1f2937'
          }}
        >
          {content.text ? renderTextWithMentions(content.text) : 'Empty note'}
        </div>
      )}
    </div>
  );
}
