import { Template } from 'meteor/templating';
import { Blaze } from 'meteor/blaze';
import { _ } from 'meteor/underscore';
import { OHIF } from 'meteor/ohif:core';

const toolMap = {
    bidirectional: 'targets',
    targetCR: 'targets',
    targetUN: 'targets',
    targetEX: 'targets'
};

OHIF.measurements.toggleLabelButton = options => {
    const removeButtonView = () => {
        if (!options.instance.buttonView) {
            return;
        }

        Blaze.remove(options.instance.buttonView);
        options.instance.buttonView = null;
    };

    if (options.instance.buttonView) {
        removeButtonView();
    }

    const tool = options.measurementTypeId || toolMap[options.toolType];
    const toolCollection = options.measurementApi[tool];
    const measurement = toolCollection.findOne(options.measurementId);

    const data = {
        measurement,
        position: options.position,
        direction: options.direction,
        threeColumns: true,
        hideCommon: true,
        autoClick: options.autoClick,
        doneCallback: removeButtonView,
        updateCallback(location, description) {
            toolCollection.update({
                measurementNumber: measurement.measurementNumber,
                toolType: measurement.toolType,
                patientId: measurement.patientId
            }, {
                $set: {
                    location,
                    description
                }
            }, {
                multi: true
            });
        }
    };
    const view = Blaze.renderWithData(Template.measureFlow, data, options.element);
    options.instance.buttonView = view;
};
