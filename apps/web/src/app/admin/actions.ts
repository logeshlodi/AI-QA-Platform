'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { removeQuarantine } from '@/lib/quarantine';
import { SettingsSchema, writeSettings } from '@/lib/settings';

/**
 * Server Functions are POST endpoints of their own: each checks the admin role itself, not only the
 * page that shows the form (a proxy matcher does not cover them).
 */
export async function saveSettings(form: FormData) {
  await requireAdmin('/admin');
  const parsed = SettingsSchema.safeParse({
    chatMaxSteps: form.get('chatMaxSteps'),
    chatTimeoutSec: form.get('chatTimeoutSec'),
    chatWritesEnabled: form.get('chatWritesEnabled') === 'on',
  });
  if (!parsed.success) redirect('/admin?saved=invalid');
  writeSettings(parsed.data);
  revalidatePath('/admin');
  redirect('/admin?saved=settings');
}

export async function releaseTest(form: FormData) {
  await requireAdmin('/admin');
  const testId = String(form.get('testId') ?? '');
  removeQuarantine(testId);
  revalidatePath('/admin');
  redirect('/admin?saved=released');
}
