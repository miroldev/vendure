import { Parent, ResolveField, Resolver } from '@nestjs/graphql';

import { FacetValue } from '../../../entity/facet-value/facet-value.entity';
import { Facet } from '../../../entity/facet/facet.entity';
import { LocaleStringHydrator } from '../../../service/helpers/locale-string-hydrator/locale-string-hydrator';
import { FacetService } from '../../../service/services/facet.service';
import { RequestContext } from '../../common/request-context';
import { Ctx } from '../../decorators/request-context.decorator';

@Resolver('FacetValue')
export class FacetValueEntityResolver {
    constructor(private facetService: FacetService, private localeStringHydrator: LocaleStringHydrator) {}

    @ResolveField()
    name(@Ctx() ctx: RequestContext, @Parent() facetValue: FacetValue): Promise<string> {
        return this.localeStringHydrator.hydrateLocaleStringField(ctx, facetValue, 'name');
    }

    @ResolveField()
    async facet(@Ctx() ctx: RequestContext, @Parent() facetValue: FacetValue): Promise<Facet | undefined> {
        if (facetValue.facet) {
            return facetValue.facet;
        }
        return this.facetService.findByFacetValueId(ctx, facetValue.id);
    }
}
