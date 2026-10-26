import { useClerk, useUser } from '@clerk/react';
import { LockKeyhole, LogOut } from 'lucide-react';
import { Btn } from '@/components/ui-bits';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

export function Forbidden({ signedOutish = false }: { signedOutish?: boolean }) {
  const { signOut } = useClerk();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  return (
    <div className="min-h-[100dvh] grid place-items-center bg-background px-4">
      <div role="alert" className="rise w-full max-w-md rounded-2xl border bg-card p-7 shadow-sm" data-testid="status-forbidden">
        <div className="mb-4 grid size-11 place-items-center rounded-full bg-accent text-accent-foreground"><LockKeyhole className="size-5" aria-hidden /></div>
        <h1 className="font-reading text-3xl font-semibold">{signedOutish ? 'Session not recognised' : 'This notebook is owner-only'}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {signedOutish
            ? 'The server could not confirm your sign-in. Sign out and sign in again.'
            : <>Margin is a private notebook that admits exactly one verified email address. {email ? <>You are signed in as <strong className="text-foreground" data-testid="text-signed-in-email">{email}</strong>, which is not that address.</> : 'The account you are signed in with is not the owner.'} No notebook data was loaded.</>}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">If this is your notebook, sign out and sign in with the owner email, and make sure it is verified.</p>
        <Btn tone="primary" className="mt-5" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out-forbidden">
          <LogOut className="size-4" aria-hidden /> Sign out
        </Btn>
      </div>
    </div>
  );
}
