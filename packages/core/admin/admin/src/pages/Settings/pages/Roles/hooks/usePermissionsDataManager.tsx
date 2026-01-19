import * as React from 'react';

import { createContext } from '@radix-ui/react-context';

import { Condition } from '../../../../../../../shared/contracts/permissions';
import { Permission as AuthPermission } from '../../../../../features/Auth';

import type {
  OnChangeCollectionTypeGlobalActionCheckboxAction,
  OnChangeCollectionTypeRowLeftCheckboxAction,
  OnChangeConditionsAction,
  State,
} from '../components/Permissions';

// Note: I had to guess most of these types based on the name and usage, but I actually don't
// know if they are correct, because the usage is very generic. Feel free to correct them if
// they create problems.
export interface PermissionsDataManagerContextValue extends Pick<State, 'modifiedData'> {
  availableConditions: Condition[];
  onChangeCollectionTypeLeftActionRowCheckbox: (
    pathToCollectionType: OnChangeCollectionTypeRowLeftCheckboxAction['pathToCollectionType'],
    propertyName: OnChangeCollectionTypeRowLeftCheckboxAction['propertyName'],
    rowName: OnChangeCollectionTypeRowLeftCheckboxAction['rowName'],
    value: OnChangeCollectionTypeRowLeftCheckboxAction['value']
  ) => void;
  onChangeConditions: (conditions: OnChangeConditionsAction['conditions']) => void;
  onChangeSimpleCheckbox: (event: { target: { name: string; value: boolean } }) => void;
  onChangeParentCheckbox: (event: { target: { name: string; value: boolean } }) => void;
  onChangeCollectionTypeGlobalActionCheckbox: (
    collectionTypeKind: OnChangeCollectionTypeGlobalActionCheckboxAction['collectionTypeKind'],
    actionId: OnChangeCollectionTypeGlobalActionCheckboxAction['actionId'],
    value: OnChangeCollectionTypeGlobalActionCheckboxAction['value']
  ) => void;
  userPermissions?: AuthPermission[];
  checkUserHasPermission: (action: string, subject?: string | null) => boolean;
}

const [PermissionsDataManagerProviderRaw, usePermissionsDataManagerContext] =
  createContext<PermissionsDataManagerContextValue>('PermissionsDataManager');

export const usePermissionsDataManager = () =>
  usePermissionsDataManagerContext('usePermissionsDataManager');

interface PermissionsDataManagerProviderProps
  extends Omit<PermissionsDataManagerContextValue, 'checkUserHasPermission'> {
  children: React.ReactNode;
}

const PermissionsDataManagerProvider = ({
  children,
  userPermissions,
  availableConditions,
  modifiedData,
  onChangeConditions,
  onChangeSimpleCheckbox,
  onChangeParentCheckbox,
  onChangeCollectionTypeLeftActionRowCheckbox,
  onChangeCollectionTypeGlobalActionCheckbox,
}: PermissionsDataManagerProviderProps) => {
  // TODO @Nico [debugging] Remove after verification
  const loggedChecksRef = React.useRef(new Set<string>());
  React.useEffect(() => {
    if (userPermissions !== undefined) {
      console.log('[App Token Permissions] User permissions loaded:', {
        count: userPermissions.length,
        permissions: userPermissions.map((p) => ({
          action: p.action,
          subject: p.subject,
        })),
      });
    }
  }, [userPermissions]);

  const checkUserHasPermission = (action: string, subject?: string | null): boolean => {
    // If userPermissions is undefined, allow all (backward compatibility for role editing)
    if (userPermissions === undefined) {
      return true;
    }

    // If userPermissions is empty array, disallow all
    if (userPermissions.length === 0) {
      return false;
    }

    // Check if user has exact permission (matching action and subject)
    const hasPermission = userPermissions.some((perm) => {
      return perm.action === action && perm.subject === subject;
    });

    // TODO @Nico [debugging] Log only first few unique checks to avoid console spam
    const checkKey = `${action}||${subject}`;
    if (!loggedChecksRef.current.has(checkKey) && loggedChecksRef.current.size < 10) {
      loggedChecksRef.current.add(checkKey);
      console.log(`[Permission Check ${hasPermission ? '✓' : '✗'}]`, {
        action,
        subject,
        hasPermission,
      });
    }

    return hasPermission;
  };

  return (
    <PermissionsDataManagerProviderRaw
      availableConditions={availableConditions}
      modifiedData={modifiedData}
      onChangeConditions={onChangeConditions}
      onChangeSimpleCheckbox={onChangeSimpleCheckbox}
      onChangeParentCheckbox={onChangeParentCheckbox}
      onChangeCollectionTypeLeftActionRowCheckbox={onChangeCollectionTypeLeftActionRowCheckbox}
      onChangeCollectionTypeGlobalActionCheckbox={onChangeCollectionTypeGlobalActionCheckbox}
      userPermissions={userPermissions}
      checkUserHasPermission={checkUserHasPermission}
    >
      {children}
    </PermissionsDataManagerProviderRaw>
  );
};

export { PermissionsDataManagerProvider };

