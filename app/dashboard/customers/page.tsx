import {auth} from '@/auth'; // Adjust the import path to your auth helper

export default async function Page() {
  const session = await auth();
  if (!session?.user?.email) {
    return <p>You must be signed in to view customers.</p>;
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Customers for {session.user.email}</h1>
    </div>
  );
}
