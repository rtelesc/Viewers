Template.measurementTableHeaderRow.onCreated(() => {
    const instance = Template.instance();
    instance.maxNumMeasurements = new ReactiveVar();

    if (!instance.data.timepointApi) {
        return;
    }

    // Get the current timepoint
    const current = instance.data.timepointApi.current();

    // Stop here if no timepoint was found
    if (!current) {
        console.warn('No current timepoint found?');
        return;
    }

    const timepointType = current.timepointType;

    // TODO: Check if we have criteria where maximum limits are applied to
    // Non-Targets and/or New Lesions
    if (timepointType === 'baseline' && instance.data.id === 'target') {
        instance.autorun(() => {
            // Identify which Trial Conformance Criteria are currently being used
            // Note that there may be more than one.
            const criteriaTypes = TrialCriteriaTypes.find({
                selected: true
            }).map(function(criteria) {
                return criteria.id;
            });

            const currentConstraints = OHIF.lesiontracker.getTrialCriteriaConstraints(criteriaTypes);
            if (!currentConstraints) {
                return;
            }

            // TODO: Fix Trial Conformance Criteria, it appears that totalNumberOfLesions
            // is applied to both Targets and Non-Targets, when it should typically only be
            // for Targets
            const criteria = currentConstraints[timepointType];
            const maxNumMeasurements = criteria.group.totalNumberOfLesions.numericality.lessThanOrEqualTo;
            instance.maxNumMeasurements.set(maxNumMeasurements);
        });
    }
});

Template.measurementTableHeaderRow.helpers({
    numberOfMeasurements() {
        const instance = Template.instance();
        if (!instance.data.measurements) {
            return;
        }
        return instance.data.measurements.length;
    },

    maxNumMeasurements() {
        const instance = Template.instance();
        if (!instance.data.measurements) {
            return;
        }
        return instance.maxNumMeasurements.get();
    },

    anyUnmarkedLesionsLeft() {
        // Skip New Lesions section
        const instance = Template.instance();
        if (!instance.data.measurements) {
            return;
        }

        const measurementType = instance.data.measurementType;
        const config = OHIF.measurements.MeasurementApi.getConfiguration();
        if (measurementType.id === config.newMeasurementTool.id) {
            return;
        }

        const timepointApi = instance.data.timepointApi;
        const current = instance.data.timepointApi.current();
        const prior = instance.data.timepointApi.prior();
        if (!prior) {
            return true;
        }

        const currentFilter = { timepointId: current.timepointId };
        const priorFilter = { timepointId: prior.timepointId };
        const measurementTypeId = measurementType.id;

        const measurementApi = instance.data.measurementApi;
        const numCurrent = measurementApi.fetch(measurementTypeId, currentFilter).length;
        const numPrior = measurementApi.fetch(measurementTypeId, priorFilter).length;
        const remaining = Math.max(numPrior - numCurrent, 0);
        return remaining > 0;
    }
});

Template.measurementTableHeaderRow.events({
    'click .js-setTool'(event, instance) {
        const measurementType = instance.data.measurementType;
        toolManager.setActiveTool(measurementType.cornerstoneToolType);
    }
});
