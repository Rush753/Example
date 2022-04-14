import React, { memo, useEffect, useState } from 'react';
import { fromJS, List, Map } from 'immutable';
import { withLDConsumer } from 'launchdarkly-react-client-sdk';
import _ from 'lodash';
import {
  AddList,
  Alert,
  alertTypes,
  Button,
  enSizes,
  enStyles,
  modalTypes,
  SimpleModal,
  Svgs,
} from '@demandbase/demandbase-ui-core';
import Prompt from 'components/common/prompt';
import {
  AdminEngagementV2ContainerProps,
  IColDefElementType,
} from './admin_engagement_v2_container';
import EngagementRuleTypes from 'constants/engagement_rule_types_v2_combined_with_alfa';
import AdminActions from 'actions/admin_actions';
import {
  getActivityTypeByLabelId,
  INTENT_RULES_LABEL,
  INTENT_SURGE_LABEL,
  INTENT_TRENDING_RULES_LABEL,
} from 'constants/engagement_intent_rule';

//AdminEngagementV2 components
import WeightListsContainer from './admin_engagement_v2_weighting';
import AdminEngagementV2SalesforceGeneralActivities from './admin_engagement_v2_salesforce_general_activities';
import AdminEngagementV2RuleRow from './admin_engagement_v2_rule_row';
import AdminEngagementV2Tabs from './admin_engagement_v2_tabs';
import AdminEngagementV2IntentActivities from './admin_engagement_v2_intent_activities';

import './admin_engagement_v2.scss';

const DEFAULT_CLASSNAME = 'admin-engagement-v2';
const GA_ALERT_MESSAGE =
  'General Activities that typically come from your organization’s website include: any connected emails or calendars from your reps, and other marketing activities if you are using Hubspot, Eloqua, or Pardot.';

const WEIGHTING_ALERT_MESSAGE =
  'Demandbase allows administrators to assign Weighting or Leveling to minutes assigned based on the person ' +
  'title or other fields of interest. For example, Engagement Minutes from a CEO might be considered more ' +
  'significant, so tou may want to assign a Weighting multiplier to reflect the additional value. You can also ' +
  'pull in your own personas or other account or people fields and add your own custom filters.';

const AdminEngagementV2 = (props: AdminEngagementV2ContainerProps) => {
  const {
    actions,
    activityTypes,
    defaultValues,
    initialRules,
    intentRulesLoading,
    intentSurgeRules,
    initGeneralRules,
    trendingIntentRules,
    trendingRulesLoading,
    colDef,
    rules,
    type,
    rulesForDeletionIds,
    rulesSame,
    viewTab,
  } = props;

  const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] = useState(false);
  const [targetId, setTargetId] = useState(null);
  const [targetIdx, setTargetIdx] = useState(null);
  const [ruleIdsToBeDeleted, setRuleIdsToBeDeleted] = useState([]);
  const [trendingRuleIdsToBeDeleted, setTrendingRuleIdsToBeDeleted] = useState([]);
  const [surgeRuleIdsToBeDeleted, setSurgeRuleIdsToBeDeleted] = useState([]);
  const [initialTrendingIntentRules, setInitialTrendingRules] = useState(null);
  const [initialIntentSurgeRules, setInitialIntentSurgeRules] = useState(null);

  // set initial rules for Intent Activities after saving rules
  useEffect(() => {
    setInitialIntentSurgeRules(intentSurgeRules);
  }, [intentRulesLoading]);
  useEffect(() => {
    setInitialTrendingRules(trendingIntentRules);
  }, [trendingRulesLoading]);
  useEffect(() => {
    if (viewTab !== EngagementRuleTypes.INTENT_RULES.route) {
      setInitialIntentSurgeRules(null);
      setInitialTrendingRules(null);
    }
  }, [viewTab]);

  const headerRenderer = () => {
    return () =>
      colDef.map(({ key, label }: IColDefElementType) => (
        <div className='row-header-item' key={`${key}-${label}`}>
          <span className={'row-header-label'}>{label}</span>
        </div>
      ));
  };

  const isGeneralActivityRuleEmpty = (rule: Map<string, any>): boolean => {
    return rule.get('activityTypeId') === undefined;
  };
  const isWeightingRuleEmpty = (rule: Map<string, any>): boolean => {
    return rule.get('name') === undefined;
  };

  const rowRenderer = (isEmptyRule?: string, rowProps?: any) => {
    return (rule: Map<string, any>, changeFunc: () => void, idx: number) => {
      let isEmpty = false;
      if (isEmptyRule === 'ga') {
        isEmpty = isGeneralActivityRuleEmpty(rule);
      }

      return (
        <div className={`${DEFAULT_CLASSNAME}__rule`}>
          <AdminEngagementV2RuleRow
            activityTypes={activityTypes}
            onChange={changeFunc}
            rule={rule}
            type={(rowProps && rowProps.type) || type}
            key={`rule-${rule.get('id')}`}
            isEmpty={isEmpty}
            {...rowProps}
          />
          <div className='delete-icon-wrapper'>
            <Svgs.IconTrash
              className='delete-icon'
              onClick={() => toggleDeleteConfirmationModal(rule, idx)}
            />
          </div>
        </div>
      );
    };
  };

  const onRuleChange = (payload: List<Map<string, any>>) => {
    let updatedPayload;
    if (type === EngagementRuleTypes.INTENT_RULES.key) {
      updatedPayload = AdminActions.getUpdatedPayload(payload);
    } else {
      updatedPayload = payload;
    }
    actions.changeEngagementRules(updatedPayload, 'rules');
  };

  const toggleDeleteConfirmationModal = (a?: any, idx?: number) => {
    setShowDeleteConfirmationModal(!showDeleteConfirmationModal);
    setTargetId(a || null);
    setTargetIdx(idx);

    if (type === EngagementRuleTypes.INTENT_RULES.key && a) {
      const activityTypeId = a.get('activityTypeId');
      const isTrendingIntentRule =
        getActivityTypeByLabelId(activityTypes, INTENT_TRENDING_RULES_LABEL) === activityTypeId;
      const isIntentSurgeRule =
        getActivityTypeByLabelId(activityTypes, INTENT_SURGE_LABEL) === activityTypeId;
      isTrendingIntentRule &&
        setTrendingRuleIdsToBeDeleted([...trendingRuleIdsToBeDeleted, ...[a.get('id')]]);
      isIntentSurgeRule &&
        setSurgeRuleIdsToBeDeleted([...surgeRuleIdsToBeDeleted, ...[a.get('id')]]);
    }
  };

  const verifyEntry = (colDefFromProps?: Array<IColDefElementType>) => {
    return (rule: Map<string, any>) => {
      return _.every(
        (colDefFromProps || colDef) as Array<IColDefElementType>,
        ({ key: colDefKey, isRequired }) => {
          if (isRequired && _.isNil(rule.get(colDefKey))) {
            console.warn(
              `[admin_engagement] @verifyEntry -> entry invalid. rule.get("${colDefKey}") must be defined. Instead got: `,
              rule.get(colDefKey)
            );
          }
          return !isRequired || !_.isNil(rule.get(colDefKey));
        }
      );
    };
  };

  const onTrendingIntentRuleChange = (payload: List<Map<string, any>>) => {
    !initialTrendingIntentRules && setInitialTrendingRules(trendingIntentRules);
    actions.changeEngagementRules(payload, 'trendingIntentRules');
  };

  const onIntentSurgeRuleChange = (payload: List<Map<string, any>>) => {
    !initialIntentSurgeRules && setInitialIntentSurgeRules(intentSurgeRules);
    actions.changeEngagementRules(payload, 'intentSurgeRules');
  };

  const mainContent = () => {
    const salesforceGeneralActivities = (
      <AdminEngagementV2SalesforceGeneralActivities
        rulesSame={rulesSame}
        defaultValues={defaultValues}
        viewTab={viewTab}
        actions={{
          onRuleChange,
          rowRenderer,
          verifyEntry,
          toggleDeleteConfirmationModal,
        }}
        colDef={colDef}
      />
    );

    const defaultAddListComponent = (
      <AddList
        defaultVal={defaultValues}
        entryRenderer={rowRenderer()}
        headerRenderer={headerRenderer()}
        onChange={onRuleChange}
        onDelete={toggleDeleteConfirmationModal}
        values={rules}
        headerClassName='list-header'
        addBtnSize={enSizes.SM}
        verifyEntry={verifyEntry()}
      />
    );

    switch (type) {
      case EngagementRuleTypes.WEIGHTING.key: {
        return <WeightListsContainer />;
      }
      case EngagementRuleTypes.GENERAL_ACTIVITIES.key: {
        return salesforceGeneralActivities;
      }
      case EngagementRuleTypes.SFDC_ACTIVITIES.key: {
        return salesforceGeneralActivities;
      }
      case EngagementRuleTypes.INTENT_RULES.key: {
        return (
          <AdminEngagementV2IntentActivities
            defaultVal={defaultValues}
            activityTypes={activityTypes}
            actions={{
              onTrendingIntentRuleChange,
              onIntentSurgeRuleChange,
              verifyEntry,
              rowRenderer,
              toggleDeleteConfirmationModal,
            }}
          />
        );
      }
      default: {
        return defaultAddListComponent;
      }
    }
  };

  const prepareIntentSurgeRulesForSaving = () => {
    const generalRules = initGeneralRules.filter(
      (item) =>
        !(
          item.get('activityTypeId') === getActivityTypeByLabelId(activityTypes, INTENT_SURGE_LABEL)
        )
    );

    const formatedIntentSurgeRules = intentSurgeRules
      .filter((rule) => Boolean(rule.get('activityTypeId')))
      .map((rule) => {
        let values = rule.get('keywords') || (List([]) as any);
        values = values.map((val: string | Map<string, any>) => {
          if (typeof val === 'string') {
            return val;
          } else {
            return val.get('name');
          }
        });
        return rule.set('values', values).delete('keywords');
      });

    return fromJS([...generalRules.toJS(), ...formatedIntentSurgeRules.toJS()]);
  };

  const prepareTrendingIntentRulesForSaving = (rule: Map<string, any>) => {
    let updatedRule = Map.isMap(rule) ? rule : (fromJS(rule) as any);
    console.log(updatedRule);
    if (updatedRule.get('keywordsType')) {
      updatedRule = updatedRule.delete('keywordsType');
    }
    if (!updatedRule.get('activityTypeId')) {
      updatedRule = updatedRule.set(
        'activityTypeId',
        getActivityTypeByLabelId(activityTypes, INTENT_TRENDING_RULES_LABEL)
      );
    }
    console.log(updatedRule.toJS());
    updatedRule = updatedRule.delete('trending').delete('strength');
    return updatedRule;
  };

  const onSave = () => {
    const rulesForDeletionIdsJS = List.isList(rulesForDeletionIds)
      ? rulesForDeletionIds.toJS()
      : rulesForDeletionIds;

    let filteredRules: any;
    switch (viewTab) {
      case EngagementRuleTypes.GENERAL_ACTIVITIES.route: {
        filteredRules = rules.filter((rule) => !isGeneralActivityRuleEmpty(rule)) as List<
          Map<string, any>
        >;
        break;
      }
      case EngagementRuleTypes.INTENT_RULES.route: {
        filteredRules = rules
          .filter((rule: Map<string, any>) => Boolean(rule.get('op')))
          .map((rule) => {
            const keywordSet = AdminActions.getUpdatedKeywordSet(rule);
            let updatedRule = rule;
            if (!updatedRule.get('activityTypeId')) {
              updatedRule = updatedRule.set(
                'activityTypeId',
                getActivityTypeByLabelId(activityTypes, INTENT_RULES_LABEL)
              );
            }
            if (keywordSet.size) {
              return updatedRule
                .delete('keywordSet')
                .delete('keywordsType')
                .set('keywords', keywordSet);
            }
            return updatedRule;
          });
        break;
      }
      case EngagementRuleTypes.WEIGHTING.route: {
        filteredRules = rules.filter(
          (rule: Map<string, any>) => !isWeightingRuleEmpty(rule)
        ) as List<Map<string, any>>;
        break;
      }
      default:
        filteredRules = rules;
    }

    const combinedIdsForDeletion: Array<number> = [...ruleIdsToBeDeleted, ...rulesForDeletionIdsJS];
    actions.saveEngagementRules(type, combinedIdsForDeletion, filteredRules);
    if (type === EngagementRuleTypes.INTENT_RULES.key) {
      const intentSurgeRulesForSaving = prepareIntentSurgeRulesForSaving();
      actions.saveEngagementRules(
        EngagementRuleTypes.INTENT_SURGE.key,
        surgeRuleIdsToBeDeleted,
        intentSurgeRulesForSaving
      );

      const trendingIntentRulesList: any = trendingIntentRules.map((rule) => {
        const keywordSet = AdminActions.getUpdatedKeywordSet(rule);
        const updatedRule = prepareTrendingIntentRulesForSaving(rule);
        if (keywordSet.size) {
          return updatedRule
            .delete('keywordSet')
            .delete('keywordsType')
            .set('keywords', keywordSet);
        }
        return updatedRule.delete('keywordSet');
      });
      actions.saveEngagementRules(
        EngagementRuleTypes.TRENDING_INTENT.key,
        trendingRuleIdsToBeDeleted,
        trendingIntentRulesList
      );
    }
    setRuleIdsToBeDeleted([]);
    setInitialTrendingRules(null);
    setInitialIntentSurgeRules(null);
  };

  const onDeleteRule = () => {
    const activityTypeId = targetId.get('activityTypeId');
    const isTrendingIntentRule =
      getActivityTypeByLabelId(activityTypes, INTENT_TRENDING_RULES_LABEL) === activityTypeId;
    const isIntentSurgeRule =
      getActivityTypeByLabelId(activityTypes, INTENT_SURGE_LABEL) === activityTypeId;

    const notInitialRules = rules !== null;
    const dontHaveActivityTypeId = !activityTypeId;
    const notIntentOrSurgeRule = !isIntentSurgeRule && !isTrendingIntentRule;
    const notNullSurgeRule = intentSurgeRules !== null && isIntentSurgeRule;
    const notNullTrendingRule = trendingIntentRules !== null && isTrendingIntentRule;

    if (notInitialRules && (dontHaveActivityTypeId || notIntentOrSurgeRule)) {
      const newRules = rules.delete(targetIdx);
      actions.changeEngagementRules(newRules, 'rules');
    }
    if (notNullSurgeRule) {
      !initialIntentSurgeRules && setInitialIntentSurgeRules(intentSurgeRules);
      const newIntentSurgeRules = intentSurgeRules.delete(targetIdx);
      actions.changeEngagementRules(newIntentSurgeRules, 'intentSurgeRules');
    }
    if (notNullTrendingRule) {
      !initialTrendingIntentRules && setInitialTrendingRules(trendingIntentRules);
      const newTrendingIntentRules = trendingIntentRules.delete(targetIdx);
      actions.changeEngagementRules(newTrendingIntentRules, 'trendingIntentRules');
    }
    setRuleIdsToBeDeleted((previousValue) => {
      return [...previousValue, targetId.get('id')];
    });
    toggleDeleteConfirmationModal();
  };

  const onCancelChanges = () => {
    if (type === EngagementRuleTypes.INTENT_RULES.key) {
      actions.changeEngagementRules(
        initialTrendingIntentRules || trendingIntentRules,
        'trendingIntentRules'
      );
      actions.changeEngagementRules(
        initialIntentSurgeRules || intentSurgeRules,
        'intentSurgeRules'
      );
      setTrendingRuleIdsToBeDeleted([]);
      setSurgeRuleIdsToBeDeleted([]);
    }

    setRuleIdsToBeDeleted([]);
    actions.changeEngagementRules(initialRules, 'rules');
  };

  const intentSurgeRulesSame =
    initialIntentSurgeRules === null ||
    _.isEqual(
      initialIntentSurgeRules && initialIntentSurgeRules.toJS(),
      intentSurgeRules && intentSurgeRules.toJS()
    );
  const trendingIntentRulesSame =
    initialTrendingIntentRules === null ||
    _.isEqual(
      initialTrendingIntentRules && initialTrendingIntentRules.toJS(),
      trendingIntentRules && trendingIntentRules.toJS()
    );
  const isRulesDeleted =
    ruleIdsToBeDeleted.length ||
    trendingRuleIdsToBeDeleted.length ||
    surgeRuleIdsToBeDeleted.length;

  const rulesAreEqual =
    rulesSame && intentSurgeRulesSame && trendingIntentRulesSame && !isRulesDeleted;

  const actionButtonsGroup = (
    <div className={`${DEFAULT_CLASSNAME}__bottom_action_group`}>
      <Button disabled={rulesAreEqual} onClick={onCancelChanges} enStyle={enStyles.SECONDARY}>
        {'Cancel'}
      </Button>
      <Button disabled={rulesAreEqual} onClick={onSave}>
        {'Save'}
      </Button>
    </div>
  );

  const deleteModal = showDeleteConfirmationModal && (
    <SimpleModal
      saveButton
      saveButtonStyle={'DANGER'}
      onSave={onDeleteRule}
      saveLabel={'Delete'}
      title={'Delete Rule Confirmation'}
      closeButton
      type={modalTypes.SECONDARY}
      closeLabel={'Cancel'}
      onClose={toggleDeleteConfirmationModal}
    >
      <div className={`${DEFAULT_CLASSNAME}__delete-modal`}>
        <div className={`${DEFAULT_CLASSNAME}__delete-modal-icon-wrapper`}>
          <div className={`${DEFAULT_CLASSNAME}__delete-modal-icon`}>
            <Svgs.IconMessagingWarning />
          </div>
        </div>
        <div className={`${DEFAULT_CLASSNAME}__delete-modal-content`}>
          {'Are you sure you want to delete this rule?'}
        </div>
      </div>
    </SimpleModal>
  );

  const alert = () => {
    let label;
    switch (type) {
      case EngagementRuleTypes.GENERAL_ACTIVITIES.key:
        label = GA_ALERT_MESSAGE;
        break;
      case EngagementRuleTypes.WEIGHTING.key: {
        label = WEIGHTING_ALERT_MESSAGE;
        break;
      }
    }
    if (!label) {
      return;
    }

    return (
      <Alert type={alertTypes.INFO} className={`${DEFAULT_CLASSNAME}__alert`} disableAnimation>
        {label}
      </Alert>
    );
  };

  return (
    <div className='admin-card-canvas'>
      <div className={`admin-card ${DEFAULT_CLASSNAME}`}>
        <AdminEngagementV2Tabs viewTab={viewTab} />
        {alert()}
        <div className={`${DEFAULT_CLASSNAME}__main-content`}>{mainContent()}</div>
        {actionButtonsGroup}
        {deleteModal}
        <Prompt
          when={!rulesAreEqual}
          message={'You have unsaved changes, are you sure you want to navigate away?'}
        />
      </div>
    </div>
  );
};

export default memo(withLDConsumer()(AdminEngagementV2));
