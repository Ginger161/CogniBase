import { redirect } from 'next/navigation';

// Studio assets now live under Study.
export default function StudioAssetsRedirect() {
  redirect('/study-guides?tab=assets');
}
