import { Route } from '@angular/router';
import { Customer } from 'shared/generated-types';

import { createResolveData } from '../common/base-entity-resolver';
import { detailBreadcrumb } from '../common/detail-breadcrumb';
import { _ } from '../core/providers/i18n/mark-for-extraction';

import { CustomerDetailComponent } from './components/customer-detail/customer-detail.component';
import { CustomerListComponent } from './components/customer-list/customer-list.component';
import { CustomerResolver } from './providers/routing/customer-resolver';

export const customerRoutes: Route[] = [
    {
        path: 'customers',
        component: CustomerListComponent,
        pathMatch: '',
        data: {
            breadcrumb: _('breadcrumb.customers'),
        },
    },
    {
        path: 'customers/:id',
        component: CustomerDetailComponent,
        resolve: createResolveData(CustomerResolver),
        data: {
            breadcrumb: customerBreadcrumb,
        },
    },
];

export function customerBreadcrumb(data: any, params: any) {
    return detailBreadcrumb<Customer.Fragment>({
        entity: data.entity,
        id: params.id,
        breadcrumbKey: 'breadcrumb.customers',
        getName: customer => `${customer.firstName} ${customer.lastName}`,
        route: 'customers',
    });
}
