import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Label } from '@/src/components/ui/Label';
import { User, Mail, Camera, Loader2, Save, LogOut } from 'lucide-react';
import { useFirebase } from '../components/FirebaseProvider';
import { db, doc, onSnapshot, setDoc, handleFirestoreError, OperationType } from '../firebase';
import { toast } from 'sonner';

interface UserProfile {
  name: string;
  photoUrl?: string;
  email: string;
}

export default function Profile() {
  const { user, logout } = useFirebase();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhoto, setEditPhoto] = useState('');

  useEffect(() => {
    if (!user) return;

    const userRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as UserProfile;
        setProfile(data);
        setEditName(data.name);
        setEditPhoto(data.photoUrl || '');
      } else {
        // Initialize profile from email if not exists
        const defaultName = user.email?.split('@')[0] || 'User';
        const initialProfile = {
          name: defaultName,
          email: user.email || '',
          photoUrl: user.photoURL || ''
        };
        setProfile(initialProfile);
        setEditName(defaultName);
        setEditPhoto(user.photoURL || '');
        
        // Save initial profile
        setDoc(userRef, initialProfile).catch(err => 
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`)
        );
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'users', user.uid), {
        name: editName,
        photoUrl: editPhoto,
        email: user.email
      }, { merge: true });
      toast.success('Profile updated successfully');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-40">
        <Loader2 className="animate-spin text-primary" size={64} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-4xl font-black tracking-tighter">My Profile</h1>
        <p className="text-muted-foreground font-medium mt-1">Manage your personal information and account settings.</p>
      </div>

      <div className="grid gap-8 md:grid-cols-12">
        <Card className="md:col-span-4 rounded-[2.5rem] border-muted/60 shadow-sm overflow-hidden h-fit">
          <CardContent className="p-8 text-center space-y-6">
            <div className="relative inline-block">
              <div className="w-32 h-32 rounded-[2.5rem] bg-primary/10 flex items-center justify-center border-4 border-background shadow-xl overflow-hidden">
                {editPhoto ? (
                  <img src={editPhoto} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User size={48} className="text-primary" />
                )}
              </div>
              <Label htmlFor="photo-upload" className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg cursor-pointer hover:scale-110 transition-transform">
                <Camera size={18} />
                <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
              </Label>
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight">{profile?.name}</h2>
              <p className="text-sm font-medium text-muted-foreground">{profile?.email}</p>
            </div>
            <div className="pt-4 border-t border-muted/60">
              <Button variant="ghost" className="w-full justify-center gap-2 text-destructive hover:bg-destructive/10 rounded-xl font-bold" onClick={logout}>
                <LogOut size={18} />
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-8 rounded-[2.5rem] border-muted/60 shadow-sm overflow-hidden">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-2xl font-black tracking-tight">Edit Profile</CardTitle>
            <CardDescription className="font-medium">Update your display name and profile picture.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName" className="font-bold">Display Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <Input 
                    id="displayName" 
                    className="pl-10 h-12 rounded-xl bg-muted/30 border-muted/60 focus:bg-background transition-all" 
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="font-bold">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground opacity-50" size={18} />
                  <Input 
                    id="email" 
                    className="pl-10 h-12 rounded-xl bg-muted/10 border-muted/60 cursor-not-allowed opacity-70" 
                    value={profile?.email} 
                    disabled 
                  />
                </div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Email cannot be changed</p>
              </div>
            </div>

            <div className="pt-6 border-t border-muted/60 flex justify-end">
              <Button className="rounded-2xl h-12 px-8 font-bold shadow-lg shadow-primary/20" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="animate-spin mr-2" size={18} /> : <Save size={18} className="mr-2" />}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
