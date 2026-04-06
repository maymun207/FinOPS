import { redirect } from 'next/navigation';

export default function SettingsIndexPage() {
  // Redirect the base settings route to the first settings sub-page
  redirect('/settings/periods');
}
