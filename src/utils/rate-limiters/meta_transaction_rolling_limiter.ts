import { Connection, Repository } from 'typeorm';

import { TransactionEntity } from '../../entities';
import { MetaTransactionRateLimiterResponse, MetaTransactionRollingLimiterConfig } from '../../types';

import { MetaTransactionRateLimiter } from './base_limiter';

export class MetaTransactionRollingLimiter extends MetaTransactionRateLimiter {
    private readonly _transactionRepository: Repository<TransactionEntity>;
    private readonly _limit: number;
    private readonly _intervalNumber: number;
    private readonly _intervalUnit: string;

    constructor(dbConnection: Connection, config: MetaTransactionRollingLimiterConfig) {
        super();
        this._transactionRepository = dbConnection.getRepository(TransactionEntity);
        this._limit = config.allowedLimit;
        this._intervalNumber = config.intervalNumber;
        this._intervalUnit = config.intervalUnit;
    }

    public async isAllowedAsync(apiKey: string): Promise<MetaTransactionRateLimiterResponse> {
        const { count } = await this._transactionRepository
            .createQueryBuilder('tx')
            .select('COUNT(*)', 'count')
            .where('tx.api_key = :apiKey', { apiKey })
            .andWhere('AGE(NOW(), tx.created_at) < :interval', {
                interval: `'${this._intervalNumber} ${this._intervalUnit}'`,
            })
            .getRawOne();

        const isAllowed = parseInt(count, 10) < this._limit;
        return {
            isAllowed,
            reason: `limit of ${this._limit} meta transactions in the last ${this._intervalNumber} ${this._intervalUnit}`,
        };
    }
}
