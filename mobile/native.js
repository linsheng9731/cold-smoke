import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const native = Capacitor.isNativePlatform();
self.COLD_SMOKE = { ...self.COLD_SMOKE, mobile: true, noDev: true, betaPreview: true };

let initialized = false;
let sharing = false;
async function cleanPhotos() {
  try {
    const { files } = await Filesystem.readdir({ path: 'photos', directory: Directory.Cache });
    await Promise.all(files.filter(f => f.type === 'file' && Date.now() - f.mtime > 86400000)
      .map(f => Filesystem.deleteFile({ path: 'photos/' + f.name, directory: Directory.Cache }).catch(() => {})));
  } catch (_) {}
}
window.ColdSmokeMobile = {
  native,
  async init({ onActive, onBack }) {
    document.getElementById('app').classList.add('mobile');
    if (!native || initialized) return;
    initialized = true;
    await App.addListener('appStateChange', ({ isActive }) => onActive(isActive));
    if (Capacitor.getPlatform() === 'android') {
      await App.addListener('backButton', async () => {
        if (!onBack()) await App.minimizeApp();
      });
    }
    const { isActive } = await App.getState();
    onActive(isActive);
    await cleanPhotos();
  },
  async sharePhoto(blob, name) {
    if (sharing) throw new Error('Share already in progress');
    sharing = true;
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      const path = 'photos/' + Date.now() + '-' + name.replace(/[^a-zA-Z0-9_.-]/g, '_');
      const { uri } = await Filesystem.writeFile({ path, data, directory: Directory.Cache, recursive: true });
      try {
        await Share.share({ title: 'Cold Smoke', files: [uri] });
      } catch (error) {
        await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {});
        throw error;
      }
      // Android receivers may read the file after the chooser has returned.
    } finally { sharing = false; }
  }
};
