import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, Observable } from 'rxjs';
import { distinctUntilChanged, map } from 'rxjs/operators';
import { GetCollectionList } from 'shared/generated-types';

import { BaseListComponent } from '../../../common/base-list.component';
import { _ } from '../../../core/providers/i18n/mark-for-extraction';
import { NotificationService } from '../../../core/providers/notification/notification.service';
import { DataService } from '../../../data/providers/data.service';
import { RearrangeEvent } from '../collection-tree/collection-tree.component';

@Component({
    selector: 'vdr-collection-list',
    templateUrl: './collection-list.component.html',
    styleUrls: ['./collection-list.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionListComponent
    extends BaseListComponent<GetCollectionList.Query, GetCollectionList.Items>
    implements OnInit {
    activeCollectionId$: Observable<string | null>;
    activeCollectionTitle$: Observable<string>;

    constructor(
        private dataService: DataService,
        private notificationService: NotificationService,
        router: Router,
        route: ActivatedRoute,
    ) {
        super(router, route);
        super.setQueryFn(
            (...args: any[]) => this.dataService.collection.getCollections(99999, 0),
            data => data.collections,
        );
    }

    ngOnInit() {
        super.ngOnInit();

        this.activeCollectionId$ = this.route.paramMap.pipe(
            map(pm => pm.get('contents')),
            distinctUntilChanged(),
        );

        this.activeCollectionTitle$ = combineLatest(this.activeCollectionId$, this.items$).pipe(
            map(([id, collections]) => {
                if (id) {
                    const match = collections.find(c => c.id === id);
                    return match ? match.name : '';
                }
                return '';
            }),
        );
    }

    onRearrange(event: RearrangeEvent) {
        this.dataService.collection.moveCollection([event]).subscribe({
            next: () => {
                this.notificationService.success(_('common.notify-saved-changes'));
                this.refresh();
            },
            error: err => {
                this.notificationService.error(_('common.notify-save-changes-error'));
            },
        });
    }

    closeContents() {
        const params = { ...this.route.snapshot.params };
        delete params.contents;
        this.router.navigate(['./', params], { relativeTo: this.route });
    }
}
