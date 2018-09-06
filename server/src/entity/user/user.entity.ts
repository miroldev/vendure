import { DeepPartial, HasCustomFields } from 'shared/shared-types';
import { Column, Entity, JoinTable, ManyToMany } from 'typeorm';

import { VendureEntity } from '../base/base.entity';
import { CustomUserFields } from '../custom-entity-fields';
import { Role } from '../role/role.entity';

@Entity()
export class User extends VendureEntity implements HasCustomFields {
    constructor(input?: DeepPartial<User>) {
        super(input);
    }

    @Column({ unique: true })
    identifier: string;

    @Column() passwordHash: string;

    @ManyToMany(type => Role)
    @JoinTable()
    roles: Role[];

    @Column({ nullable: true })
    lastLogin: string;

    @Column(type => CustomUserFields)
    customFields: CustomUserFields;
}
