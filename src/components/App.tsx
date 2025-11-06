import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { PegboardCanvas } from './PegboardCanvas';
import { Toolbar } from './Toolbar';
import { Toaster } from './ui/sonner';
import { useState, useEffect } from 'react';
import type { BoardItem, User } from './types';

export default function App() {
  const [items, setItems] = useState<BoardItem[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load items and user from localStorage
  useEffect(() => {
    const savedItems = localStorage.getItem('pegboard-items');
    const savedUser = localStorage.getItem('pegboard-user');
    const savedUsers = localStorage.getItem('pegboard-users');
    
    if (savedItems) {
      setItems(JSON.parse(savedItems));
    } else {
      // Initialize with some demo items
      setItems([
        {
          id: '1',
          type: 'note',
          x: 120,
          y: 80,
          rotation: -2,
          color: '#fef3c7',
          content: { text: 'Welcome to our apartment pegboard! 🏠' }
        },
        {
          id: '2',
          type: 'list',
          x: 400,
          y: 100,
          rotation: 1,
          content: { 
            title: 'Grocery List',
            items: [
              { text: 'Milk', checked: false },
              { text: 'Eggs', checked: true },
              { text: 'Bread', checked: false },
              { text: 'Coffee', checked: false }
            ]
          }
        },
        {
          id: '3',
          type: 'photo',
          x: 700,
          y: 150,
          rotation: -3,
          content: { 
            imageUrl: null,
            caption: 'Add your photos!'
          }
        }
      ]);
    }
    
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
    
    if (savedUsers) {
      setUsers(JSON.parse(savedUsers));
    }
    
    setIsLoading(false);
  }, []);

  // Save items to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('pegboard-items', JSON.stringify(items));
    }
  }, [items, isLoading]);

  const handleAddItem = (type: BoardItem['type']) => {
    const colors = ['#fef3c7', '#dbeafe', '#fce7f3', '#d1fae5', '#e0e7ff'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    const newItem: BoardItem = {
      id: Date.now().toString(),
      type,
      x: Math.random() * (window.innerWidth - 300) + 50,
      y: Math.random() * (window.innerHeight - 400) + 50,
      rotation: Math.random() * 6 - 3,
      color: randomColor,
      content: type === 'note' ? { text: '' } :
               type === 'list' ? { title: 'New List', items: [] } :
               type === 'photo' ? { imageUrl: null, caption: '' } :
               type === 'receipt' ? { store: '', date: new Date().toLocaleDateString(), items: [], total: 0 } :
               type === 'menu' ? { title: 'New Event', date: '', items: [] } :
               {}
    };
    
    setItems([...items, newItem]);
  };

  const handleUpdateItem = (id: string, updates: Partial<BoardItem>) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const handleDeleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('pegboard-user', JSON.stringify(user));
    
    // Add to users list if not already there
    const existingUserIndex = users.findIndex(u => u.twitterHandle === user.twitterHandle && user.twitterHandle);
    if (existingUserIndex === -1) {
      const newUsers = [...users, user];
      setUsers(newUsers);
      localStorage.setItem('pegboard-users', JSON.stringify(newUsers));
    } else {
      // Update existing user
      const newUsers = [...users];
      newUsers[existingUserIndex] = user;
      setUsers(newUsers);
      localStorage.setItem('pegboard-users', JSON.stringify(newUsers));
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('pegboard-user');
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="w-screen h-screen overflow-hidden">
        <PegboardCanvas 
          items={items}
          onUpdateItem={handleUpdateItem}
          onDeleteItem={handleDeleteItem}
          isEditMode={!!currentUser}
          users={users}
        />
        <Toolbar 
          onAddItem={handleAddItem}
          currentUser={currentUser}
          onLogin={handleLogin}
          onLogout={handleLogout}
        />
        <Toaster />
      </div>
    </DndProvider>
  );
}
