export type TripDeletionError = { kind: 'unavailable' | 'failed' };

export type TripDeletionResult =
  | { ok: true; value: undefined }
  | { ok: false; error: TripDeletionError };

export interface TripDeletionPort {
  deleteTrip(tripId: number): Promise<TripDeletionResult>;
}

export const unavailableTripDeletionPort: TripDeletionPort = {
  async deleteTrip() {
    return { ok: false, error: { kind: 'unavailable' } };
  },
};
