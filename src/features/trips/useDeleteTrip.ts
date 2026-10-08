import { useRef, useState } from 'react';

import type { TripDeletionPort } from './trip-deletion-port';

export function useDeleteTrip(tripId: number, deletionPort: TripDeletionPort, onDeleted: () => void) {
  const [confirming, setConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(false);
  const deleting = useRef(false);

  function requestDelete() {
    setError(false);
    setConfirming(true);
  }

  function cancelDelete() {
    if (deleting.current) return;
    setConfirming(false);
    setError(false);
  }

  async function confirmDelete() {
    if (deleting.current) return;
    deleting.current = true;
    setIsDeleting(true);
    setError(false);
    let deleted = false;
    try {
      const result = await deletionPort.deleteTrip(tripId);
      deleted = result.ok;
      if (!result.ok) setError(true);
    } catch {
      setError(true);
    }
    deleting.current = false;
    setIsDeleting(false);
    if (deleted) onDeleted();
  }

  return {
    confirming, isDeleting, error, requestDelete, cancelDelete,
    confirmDelete: () => void confirmDelete(),
  };
}
