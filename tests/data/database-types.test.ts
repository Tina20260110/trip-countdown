import type {
  DatabaseConnection,
  DatabaseTransactionConnection,
} from '../../src/data/database';

function compileTimeTransactionContract(connection: DatabaseConnection): void {
  void connection.withExclusiveTransactionAsync(async (transaction) => {
    const narrowed: DatabaseTransactionConnection = transaction;
    void narrowed;

    // @ts-expect-error A transaction connection cannot open another transaction.
    await transaction.withExclusiveTransactionAsync(async () => undefined);
  });
}

describe('database connection types', () => {
  it('keeps the transaction callback capability narrower than a connection', () => {
    expect(typeof compileTimeTransactionContract).toBe('function');
  });
});
