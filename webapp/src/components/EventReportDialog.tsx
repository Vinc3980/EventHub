import { useEffect, useState } from 'react';
import { Button, Sheet } from './ui';
import { useAuth } from '../app/AuthProvider';
import { useToast } from '../app/ToastProvider';
import { reportService } from '../services';
import { Report, type ReportReason } from '../models';

type ReportTarget = 'event' | 'user';

interface ReasonOption {
  label: string;
  value: ReportReason;
}

const REASONS: ReasonOption[] = [
  { label: 'Spam or misleading', value: 'spam' },
  { label: 'Inappropriate content', value: 'inappropriate' },
  { label: 'Harassment or hate speech', value: 'harassment' },
  { label: 'Violence or dangerous content', value: 'other' },
  { label: 'Other', value: 'other' },
];

export function EventReportDialog({
  open,
  onClose,
  targetType,
  targetId,
}: {
  open: boolean;
  onClose: () => void;
  targetType: ReportTarget;
  targetId: string;
}) {
  const { uid } = useAuth();
  const { success, error } = useToast();
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) setSelectedLabel(null);
  }, [open]);

  async function submit() {
    if (!uid || selectedLabel == null || busy) return;
    const option = REASONS.find((reason) => reason.label === selectedLabel);
    setBusy(true);
    try {
      await reportService.createReport(
        new Report({
          id: '',
          targetType,
          targetId,
          reporterId: uid,
          reason: option ? option.value : 'other',
          details: option ? option.label : 'Other',
          createdAt: new Date(),
        }),
      );
      success('Report submitted. Thank you.');
      onClose();
    } catch {
      error('Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Report"
      variant="center"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={busy} disabled={selectedLabel == null}>
            Submit
          </Button>
        </>
      }
    >
      <p className="text-body text-textmuted">Why are you reporting this?</p>
      <div className="mt-3 flex flex-col gap-1" role="radiogroup" aria-label="Why are you reporting this?">
        {REASONS.map((reason) => {
          const selected = selectedLabel === reason.label;
          return (
            <button
              key={reason.label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setSelectedLabel(reason.label)}
              className={`flex min-h-11 w-full items-center gap-3 rounded-md px-2 text-left transition-colors duration-200 ${
                selected ? 'bg-primary-6' : 'hover:bg-neutralbg'
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200 ${
                  selected ? 'border-primary' : 'border-border'
                }`}
              >
                {selected && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
              </span>
              <span className="min-w-0 text-body text-textprimary">{reason.label}</span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

export default EventReportDialog;
