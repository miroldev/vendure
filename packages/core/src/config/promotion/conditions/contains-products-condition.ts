import { LanguageCode } from '@vendure/common/lib/generated-types';
import { ID } from '@vendure/common/lib/shared-types';

import { idsAreEqual } from '../../../common/utils';
import { OrderLine } from '../../../entity/order-line/order-line.entity';
import { Order } from '../../../entity/order/order.entity';
import { PromotionCondition } from '../promotion-condition';

export const containsProducts = new PromotionCondition({
    code: 'contains_products',
    description: [
        { languageCode: LanguageCode.en, value: 'Buy at least { minimum } of the specified products' },
    ],
    args: {
        minimum: { type: 'int' },
        productVariantIds: {
            type: 'ID',
            list: true,
            ui: { component: 'product-selector-form-input' },
            label: [{ languageCode: LanguageCode.en, value: 'Product variants' }],
        },
    },
    async check(order: Order, args) {
        const ids = args.productVariantIds;
        let matches = 0;
        for (const line of order.lines) {
            if (lineContainsIds(ids, line)) {
                matches += line.quantity;
            }
        }
        return args.minimum <= matches;
    },
});

function lineContainsIds(ids: ID[], line: OrderLine): boolean {
    return !!ids.find(id => idsAreEqual(id, line.productVariant.id));
}
