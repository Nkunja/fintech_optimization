import { registerEnumType } from '@nestjs/graphql';
import { CashbackPercentageFilters } from '../../../common/constants';

registerEnumType(CashbackPercentageFilters, {
  name: 'CashbackPercentageFilter',
  description: 'Filter offers by cashback percentage range',
});

export { CashbackPercentageFilters };
