import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from 'sonner';

function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'rgba(15, 5, 40, 0.95)',
            border: '1px solid rgba(139, 92, 246, 0.4)',
            color: '#e2e8f0',
            backdropFilter: 'blur(12px)',
          },
        }}
      />
    </>
  );
}

export default App;
