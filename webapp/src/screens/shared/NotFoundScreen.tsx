import { useNavigate } from 'react-router-dom';
import { Danger } from 'iconsax-react';
import { Button, EmptyState } from '../../components/ui';

export default function NotFoundScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={<Danger size={26} />}
        title="Page not found"
        body="The page you're looking for doesn't exist or may have moved."
        action={<Button onClick={() => navigate('/home')}>Home</Button>}
      />
    </div>
  );
}
