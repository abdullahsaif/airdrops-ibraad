import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthWrapper';
import { Layout } from './Layout';
import { Dashboard } from './Dashboard';
import { AirdropDetails } from './AirdropDetails';
import { Runner } from './Runner';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Layout><Dashboard /></Layout>} />
          <Route path="/airdrop/:id" element={<Layout><AirdropDetails /></Layout>} />
          <Route path="/runner/:id" element={<Layout><Runner /></Layout>} />
          <Route path="/settings" element={<Layout><div className="p-8 text-center uppercase font-black italic text-gray-400 underline decoration-red-500">Settings Access Restricted in Alpha</div></Layout>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
