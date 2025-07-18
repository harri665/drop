import React, { useState, useEffect, useCallback, useRef, useImperativeHandle, forwardRef } from 'react';

// The server URL should point to your running Node.js backend
const SERVER_URL = process.env.NODE_ENV === 'production'
  ? 'https://dropapi.harrison-martin.com'
  : 'http://localhost:3001';

// --- Reusable Components ---

const DashboardColumn = ({ title, children, className = '' }) => (
  <div className={`bg-gray-800/50 rounded-lg border border-gray-700 shadow-lg p-4 flex flex-col ${className}`}>
    <h3 className="text-lg font-semibold text-gray-200 mb-3 border-b border-gray-700 pb-2">{title}</h3>
    <div className="flex-grow overflow-y-auto">
      {children}
    </div>
  </div>
);

// --- Markdown Preview Component ---
function MarkdownPreview({ content }) {
    const createMarkup = (text) => {
        let html = text
            .replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mb-2">$1</h1>')
            .replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mb-2">$1</h2>')
            .replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold mb-2">$1</h3>')
            .replace(/```([\s\S]*?)```/gim, '<pre class="bg-gray-900 p-2 rounded-md my-2 text-sm font-mono whitespace-pre-wrap"><code>$1</code></pre>')
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">$1</a>')
            .replace(/\n/g, '<br />');
        return { __html: html };
    };

    return <div className="prose prose-invert text-gray-300" dangerouslySetInnerHTML={createMarkup(content)} />;
}


// --- Fullscreen Editor Modal ---
function FullscreenNoteEditor({ note, onSave, onClose }) {
    const [content, setContent] = useState(note.content);

    const handleSave = () => {
        onSave(note.id, content);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-sm z-50 flex flex-col p-8">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Markdown Editor</h2>
                <button onClick={handleSave} className="px-6 py-2 font-semibold text-white bg-blue-500 rounded-lg shadow-md hover:bg-blue-600">
                    Save & Close
                </button>
            </div>
            <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-6">
                <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full h-full bg-gray-800 text-gray-200 p-4 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="Write your Markdown here..."
                />
                <div className="w-full h-full bg-gray-800 p-4 rounded-lg overflow-y-auto">
                    <MarkdownPreview content={content} />
                </div>
            </div>
        </div>
    );
}

// --- Dashboard Section Components ---

function NotesSection({ token, showMessage }) {
    const [notes, setNotes] = useState([]);
    const [fullscreenNote, setFullscreenNote] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    // Fetch notes from server on mount and when token changes
    useEffect(() => {
        const fetchNotes = async () => {
            if (!token) {
                setNotes([]); // Clear notes when no token
                return;
            }
            setIsLoading(true);
            try {
                const response = await fetch(`${SERVER_URL}/notes`, {
                    headers: { 'Authorization': token }
                });
                const data = await response.json();
                if (response.ok) {
                    setNotes(data.notes || []);
                } else {
                    showMessage(`Error fetching notes: ${data.message}`, 'error');
                }
            } catch (error) {
                showMessage(`Error fetching notes: ${error.message}`, 'error');
            } finally {
                setIsLoading(false);
            }
        };

        fetchNotes();
    }, [token, showMessage]);

    const handleNoteChange = async (id, content) => {
        if (!token) return;
        
        // Store original content for potential revert
        const originalNote = notes.find(note => note.id === id);
        const originalContent = originalNote ? originalNote.content : '';
        
        // Update local state immediately for better UX
        setNotes(notes.map(note => note.id === id ? { ...note, content } : note));
        
        try {
            const response = await fetch(`${SERVER_URL}/notes/${id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': token 
                },
                body: JSON.stringify({ content })
            });
            
            if (!response.ok) {
                const data = await response.json();
                showMessage(`Error updating note: ${data.message}`, 'error');
                // Revert local state on error
                setNotes(notes.map(note => note.id === id ? { ...note, content: originalContent } : note));
            }
        } catch (error) {
            showMessage(`Error updating note: ${error.message}`, 'error');
            // Revert local state on error
            setNotes(notes.map(note => note.id === id ? { ...note, content: originalContent } : note));
        }
    };

    const addNote = async () => {
        if (!token) return;
        
        try {
            const response = await fetch(`${SERVER_URL}/notes`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': token 
                },
                body: JSON.stringify({ content: '' })
            });
            
            const data = await response.json();
            if (response.ok) {
                setNotes([...notes, data.note]);
                showMessage('Note created successfully', 'success');
            } else {
                showMessage(`Error creating note: ${data.message}`, 'error');
            }
        } catch (error) {
            showMessage(`Error creating note: ${error.message}`, 'error');
        }
    };

    const deleteNote = async (id) => {
        if (!token) return;
        
        // Update local state immediately for better UX
        const originalNotes = notes;
        setNotes(notes.filter(note => note.id !== id));
        
        try {
            const response = await fetch(`${SERVER_URL}/notes/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': token }
            });
            
            if (!response.ok) {
                const data = await response.json();
                showMessage(`Error deleting note: ${data.message}`, 'error');
                // Revert local state on error
                setNotes(originalNotes);
            } else {
                showMessage('Note deleted successfully', 'success');
            }
        } catch (error) {
            showMessage(`Error deleting note: ${error.message}`, 'error');
            // Revert local state on error
            setNotes(originalNotes);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col h-full justify-center items-center">
                <div className="text-gray-400">Loading notes...</div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            {fullscreenNote && (
                <FullscreenNoteEditor
                    note={fullscreenNote}
                    onSave={handleNoteChange}
                    onClose={() => setFullscreenNote(null)}
                />
            )}
            <button
                onClick={addNote}
                className="w-full mb-4 px-4 py-2 text-sm font-semibold text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors"
            >
                Create New Note
            </button>
            <div className="space-y-4 overflow-y-auto">
                {notes.map((note, index) => (
                    <div key={note.id} className="relative bg-gray-700/50 p-2 rounded-md">
                        <div className="h-20 overflow-hidden text-sm text-gray-300">
                           {note.content ? <MarkdownPreview content={note.content} /> : <p className="text-gray-500">Empty note...</p>}
                        </div>
                         <div className="absolute top-2 right-2 flex space-x-2">
                            <button 
                                onClick={() => setFullscreenNote(note)}
                                className="text-gray-500 hover:text-blue-400"
                                aria-label="Expand note"
                            >
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 1v4m0 0h-4m4 0l-5-5" /></svg>
                            </button>
                            <button 
                                onClick={() => deleteNote(note.id)}
                                className="text-gray-500 hover:text-red-400"
                                aria-label="Delete note"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                         </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function PasswordSection() {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [error, setError] = useState('');
    const [passwords, setPasswords] = useState(() => {
        const saved = localStorage.getItem('dashboard_passwords');
        return saved ? JSON.parse(saved) : [];
    });
    const [newPassword, setNewPassword] = useState({ name: '', link: '', username: '', password: '' });
    const [visiblePasswordId, setVisiblePasswordId] = useState(null);

    useEffect(() => {
        localStorage.setItem('dashboard_passwords', JSON.stringify(passwords));
    }, [passwords]);

    const handleUnlock = async () => {
        if (!passwordInput) return;
        try {
            const res = await fetch(`${SERVER_URL}/admin/check-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': localStorage.getItem('authToken') || '' },
                body: JSON.stringify({ password: passwordInput })
            });
            if (res.ok) {
                setIsUnlocked(true);
                setError('');
            } else {
                const data = await res.json();
                setError(data.message || 'Incorrect password');
            }
        } catch {
            setError('Error verifying password');
        }
        setPasswordInput('');
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewPassword(prev => ({ ...prev, [name]: value }));
    };

    const addPassword = () => {
        if (newPassword.name && newPassword.username && newPassword.password) {
            setPasswords([...passwords, { ...newPassword, id: Date.now() }]);
            setNewPassword({ name: '', link: '', username: '', password: '' });
        }
    };

    const deletePassword = (id) => {
        setPasswords(passwords.filter(p => p.id !== id));
    };

    if (!isUnlocked) {
        return (
            <div className="flex flex-col items-center justify-center h-full">
                <h4 className="text-lg font-semibold text-gray-300">Section Locked</h4>
                <input
                    type="password"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleUnlock()}
                    className="w-full mt-4 p-2 bg-gray-700 text-white rounded-md border border-gray-600 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    placeholder="Enter password..."
                />
                <button onClick={handleUnlock} className="w-full mt-2 px-4 py-2 text-sm font-semibold text-white bg-blue-500 rounded-lg hover:bg-blue-600">
                    Unlock
                </button>
                {error && <p className="mt-2 text-red-400 text-sm">{error}</p>}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="space-y-2 mb-4 p-2 border border-gray-700 rounded-lg">
                <input type="text" name="name" value={newPassword.name} onChange={handleInputChange} placeholder="Website Name" className="w-full p-1 bg-gray-700/50 rounded-md text-sm" />
                <input type="text" name="link" value={newPassword.link} onChange={handleInputChange} placeholder="Website Link" className="w-full p-1 bg-gray-700/50 rounded-md text-sm" />
                <input type="text" name="username" value={newPassword.username} onChange={handleInputChange} placeholder="Username" className="w-full p-1 bg-gray-700/50 rounded-md text-sm" />
                <input type="password" name="password" value={newPassword.password} onChange={handleInputChange} placeholder="Password" className="w-full p-1 bg-gray-700/50 rounded-md text-sm" />
                <button onClick={addPassword} className="w-full mt-2 px-4 py-1 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700">Add Password</button>
            </div>
            <div className="space-y-2 overflow-y-auto">
                {passwords.map(p => (
                    <div key={p.id} className="p-2 bg-gray-700/50 rounded-md text-sm">
                        <div className="flex justify-between items-center">
                            <a href={p.link} target="_blank" rel="noopener noreferrer" className="font-bold text-blue-400 hover:underline truncate">{p.name}</a>
                            <div>
                                <button onClick={() => setVisiblePasswordId(visiblePasswordId === p.id ? null : p.id)} className="mr-2 text-xs text-gray-400 hover:text-white">{visiblePasswordId === p.id ? 'Hide' : 'Show'}</button>
                                <button onClick={() => deletePassword(p.id)} className="text-xs text-red-500 hover:text-red-400">Delete</button>
                            </div>
                        </div>
                        {visiblePasswordId === p.id && (
                            <div className="mt-2 pt-2 border-t border-gray-600">
                                <p><span className="font-semibold">User:</span> {p.username}</p>
                                <p><span className="font-semibold">Pass:</span> {p.password}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}


const FileColumn = forwardRef(({ title, sectionId, token, showMessage, fileTypeFilter }, ref) => {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  // State for full-screen image preview
  const [fullscreenImage, setFullscreenImage] = useState(null);

  const onFileSelect = (e) => setSelectedFile(e.target.files[0]);

  const fetchAndFilterFiles = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${SERVER_URL}/files`, { headers: { 'Authorization': token } });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch');

      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.webp'];
      const filteredFiles = data.files.filter(file => {
        const extension = file.substring(file.lastIndexOf('.')).toLowerCase();
        const isImage = imageExtensions.includes(extension);
        if (fileTypeFilter === 'image') {
          return isImage;
        } else {
          return !isImage;
        }
      });
      setFiles(filteredFiles);
    } catch (error) {
      showMessage(`Error fetching files for ${title}: ${error.message}`, 'error');
    }
  }, [token, title, fileTypeFilter, showMessage]);

  useEffect(() => {
    fetchAndFilterFiles();
  }, [fetchAndFilterFiles]);

  const onUpload = useCallback(async (fileToUpload) => {
    const file = fileToUpload || selectedFile;
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await fetch(`${SERVER_URL}/upload`, { method: 'POST', headers: { 'Authorization': token }, body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      showMessage(`Uploaded to ${title}: ${file.name}`, 'success');
      fetchAndFilterFiles(); // Re-fetch files after upload
      setSelectedFile(null);
    } catch (error) {
      showMessage(error.message, 'error');
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, token, showMessage, title, fetchAndFilterFiles]);

  useImperativeHandle(ref, () => ({
    upload(file) {
      onUpload(file);
    }
  }));

  // Handler to download a file to local device
  const handleDownload = async (filename) => {
    try {
      const res = await fetch(`${SERVER_URL}/download/${filename}`, { headers: { 'Authorization': token } });
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showMessage(error.message, 'error');
    }
  };

  // Handler to share image files on mobile using Web Share API
  const handleShare = async (filename) => {
    try {
      const res = await fetch(`${SERVER_URL}/download/${filename}`, { headers: { 'Authorization': token } });
      if (!res.ok) throw new Error('Share failed');
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type });
      await navigator.share({ files: [file] });
    } catch (error) {
      showMessage(error.message, 'error');
    }
  };

  // Handler to open image fullscreen
  const openImage = (filename) => setFullscreenImage(filename);
  const closeImage = () => setFullscreenImage(null);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col items-center gap-3">
        <label htmlFor={`${sectionId}-file-input`} className="w-full px-4 py-2 text-center font-semibold text-gray-300 bg-gray-700 border border-gray-600 rounded-lg cursor-pointer hover:bg-gray-600 transition-colors text-sm">
          {selectedFile ? selectedFile.name : 'Choose File'}
        </label>
        <input id={`${sectionId}-file-input`} type="file" className="hidden" onChange={onFileSelect} />
        <button 
          className="w-full px-5 py-2 font-semibold text-white bg-blue-500 rounded-lg shadow-md hover:bg-blue-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-sm"
          onClick={() => onUpload()}
          disabled={!selectedFile || isUploading}>
          {isUploading ? 'Uploading...' : `Upload to ${title}`}
        </button>
      </div>
      <div className="mt-4 flex-grow overflow-y-auto">
        {files.length > 0 ? (
          <ul className="divide-y divide-gray-700">
            {files.map(file => (
              <li key={file} className="py-2 flex justify-between items-center">
                {fileTypeFilter === 'image' ? (
                  <div className="flex items-center mr-4">
                    <img
                      src={`${SERVER_URL}/images/${file}?token=${token}`}
                      alt=""
                      title=""
                      className="h-16 w-16 object-cover rounded-md cursor-pointer mr-2"
                      onClick={() => openImage(file)}
                    />
                    <span className="text-gray-300 font-medium truncate text-sm">{file}</span>
                  </div>
                ) : (
                  <span className="text-gray-300 font-medium truncate pr-4 text-sm">{file}</span>
                )}
                <div className="flex items-center space-x-2">
                  {fileTypeFilter === 'image' ? null : null}
                   <button onClick={() => handleDownload(file)} className="text-xs text-blue-400 hover:underline">Download</button>
                   {fileTypeFilter === 'image' && typeof navigator !== 'undefined' && navigator.share && (
                     <button onClick={() => handleShare(file)} className="text-xs text-green-400 hover:underline">Share</button>
                   )}
                 </div>
               </li>
            ))}
          </ul>   
        ) : (
          <p className="p-4 text-center text-gray-400 text-sm">No files in this section.</p>
        )}
      </div>
      {/* Fullscreen image modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50" onClick={closeImage}>
          <img
            src={`${SERVER_URL}/images/${fullscreenImage}?token=${token}`}
            alt=""
            title=""
            className="max-h-full max-w-full"
          />
        </div>
      )}
    </div>
  );
});


function LoginModal({ onLogin, onImageClick, sequence, setSequence }) {
  return (
    <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-full max-w-sm mx-auto bg-gray-800 rounded-xl shadow-lg p-6 md:p-8 relative animate-fade-in">
        <h2 className="text-2xl font-semibold text-gray-200 text-center">Login Required</h2>
        <p className="text-center text-gray-400 mt-2 mb-4 text-sm">Click the buttons or use your keyboard (1-9, Enter, Backspace).</p>
        
        <div className="grid grid-cols-3 gap-4 max-w-xs mx-auto my-6">
        {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className={`w-20 h-20 bg-gray-700 border-2 rounded-lg cursor-pointer flex justify-center items-center text-2xl font-mono transition-all duration-200 ease-in-out
                ${sequence.includes(i) 
                  ? 'bg-green-800/50 border-green-600 scale-105 shadow-md' 
                  : 'border-gray-600 hover:border-blue-500 hover:bg-gray-600'}`}
              onClick={() => onImageClick(i)}
            >
              {sequence.indexOf(i) > -1 ? (
                <span className="text-green-400 font-bold">{sequence.indexOf(i) + 1}</span>
              ) : (
                <span className="text-gray-500">{i + 1}</span>
              )}
            </div>
          ))}
        </div>
        
        <div className="text-center my-4 text-gray-400 h-6">
          Sequence: {sequence.map(i => i + 1).join(' → ')}
        </div>
        
        <div className="flex justify-center items-center gap-4">
          <button 
            className="px-6 py-2 font-semibold text-white bg-blue-500 rounded-lg shadow-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition-colors"
            onClick={onLogin}>
            Login
          </button>
          <button 
            className="px-6 py-2 font-semibold text-gray-200 bg-gray-600 rounded-lg hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-opacity-75 transition-colors"
            onClick={() => setSequence([])}>
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}


function HomePage() {
  // --- State Management ---
  const [token, setToken] = useState(localStorage.getItem('authToken'));
  const [clickedSequence, setClickedSequence] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const filesColumnRef = useRef(null);
  const picturesColumnRef = useRef(null);

  // --- Helper to display messages ---
  const showMessage = (text, type) => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(''), 4000);
  };

  const handleLogout = useCallback(() => {
    localStorage.removeItem('authToken');
    setToken(null);
    setMessage('');
    showMessage('You have been logged out.', 'success');
  }, []);
  
  // --- Authentication Handlers ---
  const handleImageClick = useCallback((index) => {
    if (clickedSequence.length < 4) {
      setClickedSequence(prev => [...prev, index]);
    }
  }, [clickedSequence]);

  const handleLogin = useCallback(async () => {
    if (clickedSequence.length === 0) return;
    try {
      const response = await fetch(`${SERVER_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageSequence: clickedSequence.map(i => i + 1) }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }
      localStorage.setItem('authToken', data.token);
      setToken(data.token);
      showMessage('Login successful!', 'success');
      setClickedSequence([]);
    } catch (error) {
      showMessage(error.message, 'error');
      setClickedSequence([]);
    }
  }, [clickedSequence]);

  useEffect(() => {
    if (token) return;
    const handleKeyDown = (event) => {
      // Map keys 1-9 to indices 0-8
      if (event.key >= '1' && event.key <= '9') {
        handleImageClick(parseInt(event.key, 10) - 1);
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        handleLogin();
      }
      if (event.key === 'Backspace') {
        setClickedSequence(prev => prev.slice(0, -1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [token, handleImageClick, handleLogin]);

  useEffect(() => {
    if (!token) return;
    const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('image/')) {
            picturesColumnRef.current?.upload(file);
        } else {
            filesColumnRef.current?.upload(file);
        }
        e.dataTransfer.clearData();
      }
    };
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);
    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [token]);
  
  // --- Render Logic ---
  
  return (
    <div className="dark bg-gray-900 min-h-screen text-white p-4 sm:p-6 lg:p-8">
      {!token && <LoginModal onLogin={handleLogin} onImageClick={handleImageClick} sequence={clickedSequence} setSequence={setClickedSequence} />}
      
      {isDragging && token && (
        <div className="fixed inset-0 bg-gray-900/80 flex items-center justify-center z-50 pointer-events-none">
          <div className="text-center text-white text-2xl font-bold border-4 border-dashed border-white rounded-lg p-12">
            Drop File to Upload
          </div>
        </div>
      )}

      <header className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-100">
          <span role="img" aria-label="down arrow">⬇️</span> Dashboard
        </h1>
        {token && (
          <button 
            className="px-4 py-2 font-semibold text-white bg-red-500 rounded-lg shadow-md hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-opacity-75 transition-colors"
            onClick={handleLogout}>
            Logout
          </button>
        )}
      </header>

      {message && (
        <div className={`p-3 my-4 rounded-lg text-center font-semibold animate-fade-in
          ${messageType === 'success' ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
          {message}
        </div>
      )}

      {token && (
        <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 h-[calc(100vh-12rem)]">
          <DashboardColumn title="Notes">
            <NotesSection token={token} showMessage={showMessage} />
          </DashboardColumn>
          <DashboardColumn title="Files">
            <FileColumn ref={filesColumnRef} title="Files" sectionId="files" token={token} showMessage={showMessage} fileTypeFilter="other" />
          </DashboardColumn>
          <DashboardColumn title="Passwords">
             <PasswordSection />
          </DashboardColumn>
          <DashboardColumn title="Pictures">
             <FileColumn ref={picturesColumnRef} title="Pictures" sectionId="pictures" token={token} showMessage={showMessage} fileTypeFilter="image" />
          </DashboardColumn>
        </main>
      )}
    </div>
  );
}

function App() {
    return <HomePage />;
}

export default App;
