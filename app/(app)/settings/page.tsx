'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import { supabase } from '@/utils/supabase/client';
import { formatSmartTime } from '@/lib/utils/time';
import { Activity, User, Sliders, Zap, BookOpen, CheckCircle, UploadCloud, Loader2, Shield } from 'lucide-react';
import { toast } from 'sonner';
import CustomSelect from '@/components/ui/CustomSelect';
import { useUserContext } from '@/lib/hooks/useUserContext';

type Tab = 'profile' | 'preferences' | 'account' | 'activity';

export default function SettingsPage() {
  const { setTheme } = useTheme();
  const { context: globalContext, mutate } = useUserContext();
  const [userData, setUserData] = useState<any>({
    name: 'Loading...',
    email: '',
    uid: '',
    school: '',
    department: '',
    preferences: {
      theme: 'system',
      sidebarMode: 'expanded',
      dailyFocusGoal: 120,
      guideComplexity: 'standard'
    }
  });
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const updateField = (field: string, value: any) => {
    setUserData((prev: any) => ({ ...prev, [field]: value }));
  };

  const updatePreference = (field: string, value: any) => {
    setUserData((prev: any) => ({ ...prev, preferences: { ...prev.preferences, [field]: value } }));
  };

  const handleThemeChange = async (themeValue: string) => {
    updatePreference('theme', themeValue);
    setTheme(themeValue);
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userData.name,
          school: userData.school,
          department: userData.department,
          preferences: {
            theme: themeValue,
            sidebarMode: userData.preferences?.sidebarMode || 'expanded',
            dailyFocusGoal: userData.preferences?.dailyFocusGoal ?? 120,
            guideComplexity: userData.preferences?.guideComplexity || 'standard'
          }
        })
      });
    } catch (e) {
      console.error("Failed to save theme:", e);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setErrors({});

    if (!userData.name || userData.name.trim() === '') {
      setErrors({ displayName: true });
      setIsSaving(false);
      return;
    }

    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userData.name,
          school: userData.school,
          department: userData.department,
          preferences: {
            theme: userData.preferences?.theme || 'charcoal',
            sidebarMode: userData.preferences?.sidebarMode || 'expanded',
            dailyFocusGoal: userData.preferences?.dailyFocusGoal ?? 120,
            guideComplexity: userData.preferences?.guideComplexity || 'standard'
          }
        })
      });
      toast.success('Settings updated successfully!');
      await mutate();
    } catch (e) {
      toast.error('Failed to update settings');
    }
    setIsSaving(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update password.');
    }
    setIsChangingPassword(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/settings/export');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cognibase-data-export.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Your data export has started downloading.');
    } catch (e) {
      toast.error('Failed to export your data. Please try again.');
    }
    setIsExporting(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== userData.email) {
      toast.error('Please type your email exactly to confirm.');
      return;
    }
    setIsDeleting(true);
    try {
      const res = await fetch('/api/settings/account', { method: 'DELETE' });
      if (!res.ok) throw new Error('Deletion failed');
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (e) {
      toast.error('Failed to delete account. Please try again or contact support.');
      setIsDeleting(false);
    }
  };

  useEffect(() => {
    if (globalContext) {
      setUserData(globalContext);
    }
  }, [globalContext]);

  useEffect(() => {
    if (activeTab === 'activity' && userData.uid) {
      setIsLoadingLogs(true);
      fetch(`/api/audit-logs?userId=${userData.uid}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setAuditLogs(data);
          setIsLoadingLogs(false);
        })
        .catch(err => {
          console.error("Failed to fetch logs", err);
          setIsLoadingLogs(false);
        });
    }
  }, [activeTab, userData.uid]);

  const tabs = [
    { id: 'profile', label: 'Profile', shortLabel: 'Profile', icon: <User size={18} /> },
    { id: 'preferences', label: 'Preferences', shortLabel: 'Prefs', icon: <Sliders size={18} /> },
    { id: 'account', label: 'Account', shortLabel: 'Account', icon: <Shield size={18} /> },
    { id: 'activity', label: 'Activity Log', shortLabel: 'Activity', icon: <Activity size={18} /> },
  ];

  return (
    <>
      <style>{`
        body { margin: 0; padding: 0; font-family: 'Inter', sans-serif; background-color: #09090B; color: #F9FAFB; overflow: hidden; }
        .dashboard-layout { display: flex; height: 100dvh; width: 100vw; overflow: hidden; }
        .settings-container { display: flex; flex: 1; overflow: hidden; }
        .settings-sidebar { width: 280px; border-right: 1px solid #27272A; background-color: #111111; padding: 2rem 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
        .settings-content { flex: 1; padding: 3rem; overflow-y: auto; background-color: #09090B; }
        .settings-tab { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s; color: #A1A1AA; font-weight: 500; }
        .settings-tab:hover { background-color: #18181B; color: #E4E4E7; }
        .settings-tab.active { background: linear-gradient(135deg, #EA580C, #C2410C); color: white; box-shadow: 0 4px 14px -4px rgba(234,88,12,0.5); }
        @media (max-width: 768px) {
          .settings-container { flex-direction: column; }
          .settings-sidebar { width: 100%; border-right: none; border-bottom: 1px solid #27272A; padding: 0.6rem; display: flex; flex-direction: row; background-color: #18181B; gap: 4px; }
          .settings-tab { white-space: nowrap; padding: 0.5rem 0.25rem; font-size: 0.75rem; justify-content: center; flex: 1; border-radius: 0.4rem; }
          .settings-content { padding: 1.5rem; }
        }
      `}</style>

      <div className="flex flex-col h-full w-full">
        <div className="flex-1 flex flex-col h-full overflow-hidden p-6">
          <div className="settings-container w-full h-full">
            <div className="settings-sidebar pt-16 lg:pt-8">
              <h2 className="hidden sm:block text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4 px-4">User Settings</h2>
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id as Tab)}
                >
                  <span className="hidden sm:inline-flex">{tab.icon}</span>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </div>
              ))}
            </div>

            <div className="settings-content">
              <div className="max-w-3xl">

                {activeTab === 'profile' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="font-mono text-orange-500 text-xl font-bold">&gt;_</span>
                        <h1 className="text-3xl font-bold">My Profile</h1>
                      </div>
                      <p className="text-zinc-400">Manage your identity and basic information.</p>
                    </div>
                    <div className="bg-[#111111] border border-[#27272A] rounded-xl p-6 space-y-6">
                      <div className="flex items-center gap-6">
                        <div className="w-20 h-20 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 text-2xl font-bold">
                          {userData.name.charAt(0).toUpperCase()}
                        </div>

                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-300">Email Address</label>
                        <input type="email" disabled className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-4 py-2.5 text-zinc-500 cursor-not-allowed" value={userData.email} />
                        <p className="text-xs text-zinc-500 mt-1">To change your email, please contact support.</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-zinc-300">Display Name</label>
                        <input id="displayName" type="text" disabled={isSaving} className={`w-full bg-[#18181B] border ${errors.displayName ? 'border-red-500' : 'border-[#27272A]'} rounded-lg px-4 py-2.5 text-white focus:border-orange-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed`} value={userData.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Enter display name" />
                        {errors.displayName && <p className="text-red-500 text-xs mt-1">Display name cannot be empty.</p>}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-300">University / Institution</label>
                          <input id="school" type="text" disabled={isSaving} value={userData.school || ''} onChange={(e) => updateField('school', e.target.value)} className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-4 py-2.5 text-white focus:border-orange-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed" placeholder="e.g., Veritas University" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-zinc-300">Major / Department</label>
                          <input id="department" type="text" disabled={isSaving} value={userData.department || ''} onChange={(e) => updateField('department', e.target.value)} className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-4 py-2.5 text-white focus:border-orange-500 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed" placeholder="e.g., Educational Management" />
                        </div>
                      </div>
                      <button onClick={handleSave} disabled={isSaving} className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[140px]">
                        {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'preferences' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="font-mono text-orange-500 text-xl font-bold">&gt;_</span>
                        <h1 className="text-3xl font-bold">Preferences</h1>
                      </div>
                      <p className="text-zinc-400">Configure your study goals and application behavior.</p>
                    </div>
                    <div className="bg-[#111111] border border-[#27272A] rounded-xl p-6 space-y-8">

                      <div>
                        <div className="mb-4">
                          <h3 className="font-semibold text-white">Theme Selection</h3>
                          <p className="text-sm text-zinc-400 mt-1">Choose how CogniBase looks for you.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <label className="cursor-pointer">
                            <input type="radio" name="theme" value="charcoal" className="peer sr-only" checked={userData.preferences?.theme === 'charcoal'} onChange={() => handleThemeChange('charcoal')} />
                            <div className="border border-[#27272A] peer-checked:border-orange-500 peer-checked:ring-1 peer-checked:ring-orange-500 rounded-xl p-4 bg-zinc-900 transition-all relative overflow-hidden group">
                              <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900 opacity-50"></div>
                              <div className="relative z-10 flex flex-col items-center gap-3">
                                <div className="w-full h-16 bg-zinc-800 rounded flex gap-2 p-2">
                                  <div className="w-1/3 bg-zinc-700 rounded"></div>
                                  <div className="w-2/3 bg-zinc-700 rounded"></div>
                                </div>
                                <span className="font-semibold text-zinc-300 peer-checked:text-white text-sm">System</span>
                              </div>
                            </div>
                          </label>
                          <label className="cursor-pointer">
                            <input type="radio" name="theme" value="dark" className="peer sr-only" checked={userData.preferences?.theme === 'dark'} onChange={() => handleThemeChange('dark')} />
                            <div className="border border-[#27272A] peer-checked:border-orange-500 peer-checked:ring-1 peer-checked:ring-orange-500 rounded-xl p-4 bg-black transition-all relative overflow-hidden group">
                              <div className="absolute inset-0 bg-gradient-to-br from-black to-zinc-950 opacity-50"></div>
                              <div className="relative z-10 flex flex-col items-center gap-3">
                                <div className="w-full h-16 bg-[#0a0a0a] border border-[#262626] rounded flex gap-2 p-2">
                                  <div className="w-1/3 bg-[#141414] rounded"></div>
                                  <div className="w-2/3 bg-[#141414] rounded"></div>
                                </div>
                                <span className="font-semibold text-zinc-300 peer-checked:text-white text-sm">Deep Dark</span>
                              </div>
                            </div>
                          </label>
                          <label className="cursor-pointer">
                            <input type="radio" name="theme" value="ivory" className="peer sr-only" checked={userData.preferences?.theme === 'ivory'} onChange={() => handleThemeChange('ivory')} />
                            <div className="border border-[#27272A] peer-checked:border-orange-500 peer-checked:ring-1 peer-checked:ring-orange-500 rounded-xl p-4 bg-[#FAF9F7] transition-all relative overflow-hidden group">
                              <div className="relative z-10 flex flex-col items-center gap-3">
                                <div className="w-full h-16 bg-white border border-[#E7E4DE] rounded flex gap-2 p-2">
                                  <div className="w-1/3 bg-[#F5F4F1] rounded"></div>
                                  <div className="w-2/3 bg-[#F5F4F1] rounded"></div>
                                </div>
                                <span className="font-semibold text-[#57534E] peer-checked:text-[#1C1917] text-sm">Ivory</span>
                              </div>
                            </div>
                          </label>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 border-t border-[#27272A]">
                        <div>
                          <h3 className="font-semibold text-white">Study Engine Default</h3>
                          <p className="text-sm text-zinc-400 mt-1">Select the default processing mode for new documents.</p>
                        </div>
                        <div className="w-full sm:w-auto">
                          <CustomSelect
                            id="guideComplexity"
                            value={userData.preferences?.guideComplexity || 'standard'}
                            onChange={(val) => updatePreference('guideComplexity', val)}
                            options={[
                              { value: 'cram', label: 'Cram Mode (Micro-bites)' },
                              { value: 'standard', label: 'Standard Depth' },
                              { value: 'deep', label: 'Deep Dive' },
                            ]}
                          />
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 border-t border-[#27272A]">
                        <div>
                          <h3 className="font-semibold text-white">Focus Mode</h3>
                          <p className="text-sm text-zinc-400 mt-1">Automatically collapse sidebars when viewing a document.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input id="sidebarMode" type="checkbox" className="sr-only peer" checked={userData.preferences?.sidebarMode === 'collapsed'} onChange={(e) => updatePreference('sidebarMode', e.target.checked ? 'collapsed' : 'expanded')} />
                          <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                        </label>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-6 border-t border-[#27272A]">
                        <div className="pr-4">
                          <h3 className="font-semibold text-white">Daily Focus Goal</h3>
                          <p className="text-sm text-zinc-400 mt-1">Target focus minutes per day for the gamification rings.</p>
                        </div>
                        <input id="dailyFocusGoal" type="number" min="10" max="600" value={userData.preferences?.dailyFocusGoal ?? 120} onChange={(e) => updatePreference('dailyFocusGoal', parseInt(e.target.value) || 0)} className="w-full sm:w-24 bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2 text-white text-center focus:border-orange-500 outline-none" />
                      </div>

                      <div className="pt-6 border-t border-[#27272A]">
                        <button onClick={handleSave} disabled={isSaving} className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[140px]">
                          {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save Changes'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'account' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="font-mono text-orange-500 text-xl font-bold">&gt;_</span>
                        <h1 className="text-3xl font-bold">Account</h1>
                      </div>
                      <p className="text-zinc-400">Manage your password, data, and session.</p>
                    </div>

                    <div className="bg-[#111111] border border-[#27272A] rounded-xl p-6 space-y-4">
                      <div>
                        <h3 className="font-semibold text-white mb-1">Change Password</h3>
                        <p className="text-sm text-zinc-400 mb-4">Choose a new password for your account.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-4 py-2.5 text-white focus:border-orange-500 outline-none transition-colors" />
                          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" className="w-full bg-[#18181B] border border-[#27272A] rounded-lg px-4 py-2.5 text-white focus:border-orange-500 outline-none transition-colors" />
                        </div>
                        <button onClick={handleChangePassword} disabled={isChangingPassword} className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2.5 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                          {isChangingPassword ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update Password'}
                        </button>
                      </div>
                    </div>

                    <div className="bg-[#111111] border border-[#27272A] rounded-xl p-6 space-y-4">
                      <div>
                        <h3 className="font-semibold text-white mb-1">Export Your Data</h3>
                        <p className="text-sm text-zinc-400 mb-4">Download a copy of your profile, workspaces, documents, and study guides.</p>
                        <button onClick={handleExportData} disabled={isExporting} className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-700">
                          {isExporting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Export My Data'}
                        </button>
                      </div>
                    </div>

                    <div className="bg-[#111111] border border-[#27272A] rounded-xl p-6">
                      <button onClick={handleSignOut} className="bg-zinc-800 hover:bg-zinc-700 text-white font-semibold py-2.5 px-6 rounded-lg transition-colors border border-zinc-700">
                        Sign Out
                      </button>
                    </div>

                    <div className="bg-red-950/20 border border-red-900/50 rounded-xl p-6 space-y-4">
                      <div>
                        <h3 className="font-semibold text-red-400 mb-1">Delete Account</h3>
                        <p className="text-sm text-zinc-400 mb-4">This permanently deletes your account and everything in it — documents, guides, chats, and progress. This cannot be undone.</p>
                        <p className="text-sm text-zinc-300 mb-2">Type your email (<span className="font-semibold">{userData.email}</span>) to confirm:</p>
                        <input type="text" value={deleteConfirmText} onChange={(e) => setDeleteConfirmText(e.target.value)} placeholder="Enter your email" className="w-full max-w-md bg-[#18181B] border border-red-900/50 rounded-lg px-4 py-2.5 text-white focus:border-red-500 outline-none transition-colors mb-4" />
                        <button onClick={handleDeleteAccount} disabled={isDeleting || deleteConfirmText !== userData.email} className="bg-red-700 hover:bg-red-600 text-white font-bold py-2.5 px-6 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                          {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Permanently Delete My Account'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'activity' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div>
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="font-mono text-orange-500 text-xl font-bold">&gt;_</span>
                        <h1 className="text-3xl font-bold">Activity Log</h1>
                      </div>
                      <p className="text-zinc-400">A timeline of your actions across the system (Last 20).</p>
                    </div>
                    <div className="bg-[#111111] border border-[#27272A] rounded-xl p-6">
                      {isLoadingLogs ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                          <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-zinc-500 text-sm">Fetching logs...</span>
                        </div>
                      ) : auditLogs.length > 0 ? (
                        <div className="relative border-l border-zinc-800 ml-4 space-y-10 py-2">
                          {auditLogs.map((log: any, i: number) => {
                            let Icon = Activity;
                            let iconColor = 'text-zinc-400';
                            let glowColor = 'bg-zinc-500/20';

                            if (log.action.toLowerCase().includes('generate') || log.action.toLowerCase().includes('create')) {
                              Icon = Zap;
                              iconColor = 'text-yellow-400';
                              glowColor = 'bg-yellow-500/20';
                            } else if (log.action.toLowerCase().includes('study') || log.action.toLowerCase().includes('read') || log.action.toLowerCase().includes('review')) {
                              Icon = BookOpen;
                              iconColor = 'text-blue-400';
                              glowColor = 'bg-blue-500/20';
                            } else if (log.action.toLowerCase().includes('upload') || log.action.toLowerCase().includes('add')) {
                              Icon = UploadCloud;
                              iconColor = 'text-green-400';
                              glowColor = 'bg-green-500/20';
                            } else if (log.action.toLowerCase().includes('update') || log.action.toLowerCase().includes('edit')) {
                              Icon = CheckCircle;
                              iconColor = 'text-purple-400';
                              glowColor = 'bg-purple-500/20';
                            }

                            return (
                              <div key={log.id} className="relative pl-8 group">
                                <div className={`absolute -left-[18px] top-0.5 w-9 h-9 rounded-full bg-[#111111] border border-zinc-800 flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0.5)] z-10 ${glowColor} group-hover:border-zinc-600 transition-colors`}>
                                  <Icon size={16} className={iconColor} />
                                </div>

                                <div className="flex flex-col gap-1.5 pt-1">
                                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">{formatSmartTime(log.createdAt)}</span>
                                  <h3 className="text-base font-bold text-zinc-200">{log.action}</h3>
                                  {log.details && (
                                    <p className="text-sm text-zinc-400 leading-relaxed mt-0.5">{log.details}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-zinc-500">
                          <Activity className="mx-auto h-12 w-12 text-zinc-700 mb-4" />
                          <p>No activity logs found for your account.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
