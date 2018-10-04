import { Address } from './address/address.entity';
import { AdjustmentSource } from './adjustment-source/adjustment-source.entity';
import { Administrator } from './administrator/administrator.entity';
import { Asset } from './asset/asset.entity';
import { Channel } from './channel/channel.entity';
import { Customer } from './customer/customer.entity';
import { FacetValueTranslation } from './facet-value/facet-value-translation.entity';
import { FacetValue } from './facet-value/facet-value.entity';
import { FacetTranslation } from './facet/facet-translation.entity';
import { Facet } from './facet/facet.entity';
import { OrderItem } from './order-item/order-item.entity';
import { Order } from './order/order.entity';
import { ProductOptionGroupTranslation } from './product-option-group/product-option-group-translation.entity';
import { ProductOptionGroup } from './product-option-group/product-option-group.entity';
import { ProductOptionTranslation } from './product-option/product-option-translation.entity';
import { ProductOption } from './product-option/product-option.entity';
import { ProductVariantPrice } from './product-variant/product-variant-price.entity';
import { ProductVariantTranslation } from './product-variant/product-variant-translation.entity';
import { ProductVariant } from './product-variant/product-variant.entity';
import { ProductTranslation } from './product/product-translation.entity';
import { Product } from './product/product.entity';
import { Role } from './role/role.entity';
import { AnonymousSession } from './session/anonymous-session.entity';
import { AuthenticatedSession } from './session/authenticated-session.entity';
import { Session } from './session/session.entity';
import { User } from './user/user.entity';

/**
 * A map of all the core database entities.
 */
export const coreEntitiesMap = {
    Address,
    AdjustmentSource,
    Administrator,
    AnonymousSession,
    Asset,
    AuthenticatedSession,
    Channel,
    Customer,
    Facet,
    FacetTranslation,
    FacetValue,
    FacetValueTranslation,
    Order,
    OrderItem,
    Product,
    ProductOption,
    ProductOptionGroup,
    ProductOptionGroupTranslation,
    ProductOptionTranslation,
    ProductTranslation,
    ProductVariant,
    ProductVariantPrice,
    ProductVariantTranslation,
    Role,
    Session,
    User,
};
