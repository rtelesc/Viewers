import { parseFloatArray } from '../../lib/parseFloatArray';

/**
 * Simple cache schema for retrieved color palettes.
 */
const paletteColorCache = {
    count: 0,
    maxAge: 24 * 60 * 60 * 1000, // 24h cache?
    entries: {},
    isValidUID: function (paletteUID) {
        return typeof paletteUID === 'string' && paletteUID.length > 0;
    },
    get: function (paletteUID) {
        let entry = null;
        if (this.entries.hasOwnProperty(paletteUID)) {
            entry = this.entries[paletteUID];
            // check how the entry is...
            if ((Date.now() - entry.time) > this.maxAge) {
                // entry is too old... remove entry.
                delete this.entries[paletteUID];
                this.count--;
                entry = null;
            }
        }
        return entry;
    },
    add: function (entry) {
        if (this.isValidUID(entry.uid)) {
            let paletteUID = entry.uid;
            if (this.entries.hasOwnProperty(paletteUID) !== true) {
                this.count++; // increment cache entry count...
            }
            entry.time = Date.now();
            this.entries[paletteUID] = entry;
            // @TODO: Add logic to get rid of old entries and reduce memory usage...
        }
    }
};

/**
 * Creates a URL for a WADO search
 *
 * @param server
 * @param studyInstanceUid
 * @returns {string}
 */
function buildUrl(server, studyInstanceUid) {
    return server.wadoRoot + '/studies/' + studyInstanceUid + '/metadata';
}

/**
 * Parses the SourceImageSequence, if it exists, in order
 * to return a ReferenceSOPInstanceUID. The ReferenceSOPInstanceUID
 * is used to refer to this image in any accompanying DICOM-SR documents.
 *
 * @param instance
 * @returns {String} The ReferenceSOPInstanceUID
 */
function getSourceImageInstanceUid(instance) {
    // TODO= Parse the whole Source Image Sequence
    // This is a really poor workaround for now.
    // Later we should probably parse the whole sequence.
    var SourceImageSequence = instance['00082112'];
    if (SourceImageSequence && SourceImageSequence.Value && SourceImageSequence.Value.length) {
        return SourceImageSequence.Value[0]['00081155'].Value[0];
    }
}


/**
 * Fetch palette colors for instances with "PALETTE COLOR" photometricInterpretation.
 *
 * @param server {Object} Current server;
 * @param instance {Object} The retrieved instance metadata;
 * @returns {String} The ReferenceSOPInstanceUID
 */
function getPaletteColors(server, instance) {

    let entry = null,
        paletteUID = DICOMWeb.getString(instance['00281199']);

    if (paletteColorCache.isValidUID(paletteUID)) {
        entry = paletteColorCache.get(paletteUID);
    } else {
        paletteUID = null;
    }

    if (!entry) {
        // no entry on cache... Fetch remote data.
        try {
            let r, g, b;
            r = DICOMWeb.getBulkData(instance['00281201'].BulkDataURI, server.requestOptions);
            g = DICOMWeb.getBulkData(instance['00281202'].BulkDataURI, server.requestOptions);
            b = DICOMWeb.getBulkData(instance['00281203'].BulkDataURI, server.requestOptions);
            entry = { red: r, green: g, blue: b };
            if (paletteUID !== null) {
                // when paletteUID is present, the entry can be cached...
                entry.uid = paletteUID;
                paletteColorCache.add(entry);
            }
        } catch (error) {
            console.log(`(${error.name}) ${error.message}`);
        }
    }

    return entry;

}



/**
 * Parses result data from a WADO search into Study MetaData
 * Returns an object populated with study metadata, including the
 * series list.
 *
 * @param server
 * @param studyInstanceUid
 * @param resultData
 * @returns {{seriesList: Array, patientName: *, patientId: *, accessionNumber: *, studyDate: *, modalities: *, studyDescription: *, imageCount: *, studyInstanceUid: *}}
 */
function resultDataToStudyMetadata(server, studyInstanceUid, resultData) {
    var seriesMap = {};
    var seriesList = [];

    if (!resultData.length) {
        return;
    }

    var anInstance = resultData[0];
    if (!anInstance) {
        return;
    }

    var studyData = {
        seriesList: seriesList,
        patientName: DICOMWeb.getName(anInstance['00100010']),
        patientId: DICOMWeb.getString(anInstance['00100020']),
        accessionNumber: DICOMWeb.getString(anInstance['00080050']),
        studyDate: DICOMWeb.getString(anInstance['00080020']),
        modalities: DICOMWeb.getString(anInstance['00080061']),
        studyDescription: DICOMWeb.getString(anInstance['00081030']),
        imageCount: DICOMWeb.getString(anInstance['00201208']),
        studyInstanceUid: DICOMWeb.getString(anInstance['0020000D']),
        institutionName: DICOMWeb.getString(anInstance['00080080'])
    };

    resultData.forEach(function(instance) {
        var seriesInstanceUid = DICOMWeb.getString(instance['0020000E']);
        var series = seriesMap[seriesInstanceUid];
        if (!series) {
            series = {
                seriesDescription: DICOMWeb.getString(instance['0008103E']),
                modality: DICOMWeb.getString(instance['00080060']),
                seriesInstanceUid: seriesInstanceUid,
                seriesNumber: DICOMWeb.getNumber(instance['00200011']),
                instances: []
            };
            seriesMap[seriesInstanceUid] = series;
            seriesList.push(series);
        }

        var sopInstanceUid = DICOMWeb.getString(instance['00080018']);

        var instanceSummary = {
            imageType: DICOMWeb.getString(instance['00080008']),
            sopClassUid: DICOMWeb.getString(instance['00080016']),
            modality: DICOMWeb.getString(instance['00080060']),
            sopInstanceUid: sopInstanceUid,
            instanceNumber: DICOMWeb.getNumber(instance['00200013']),
            imagePositionPatient: DICOMWeb.getString(instance['00200032']),
            imageOrientationPatient: DICOMWeb.getString(instance['00200037']),
            frameOfReferenceUID: DICOMWeb.getString(instance['00200052']),
            sliceLocation: DICOMWeb.getNumber(instance['00201041']),
            samplesPerPixel: DICOMWeb.getNumber(instance['00280002']),
            photometricInterpretation: DICOMWeb.getString(instance['00280004']),
            planarConfiguration: DICOMWeb.getNumber(instance['00280006']),
            rows: DICOMWeb.getNumber(instance['00280010']),
            columns: DICOMWeb.getNumber(instance['00280011']),
            pixelSpacing: DICOMWeb.getString(instance['00280030']),
            bitsAllocated: DICOMWeb.getNumber(instance['00280100']),
            bitsStored: DICOMWeb.getNumber(instance['00280101']),
            highBit: DICOMWeb.getNumber(instance['00280102']),
            pixelRepresentation: DICOMWeb.getNumber(instance['00280103']),
            windowCenter: DICOMWeb.getString(instance['00281050']),
            windowWidth: DICOMWeb.getString(instance['00281051']),
            rescaleIntercept: DICOMWeb.getNumber(instance['00281052']),
            rescaleSlope: DICOMWeb.getNumber(instance['00281053']),
            sourceImageInstanceUid: getSourceImageInstanceUid(instance),
            laterality: DICOMWeb.getString(instance['00200062']),
            viewPosition: DICOMWeb.getString(instance['00185101']),
            acquisitionDatetime: DICOMWeb.getString(instance['0008002A']),
            numFrames: DICOMWeb.getNumber(instance['00280008']),
            frameIncrementPointer: DICOMWeb.getAttribute(instance['00280009']),
            frameTime: DICOMWeb.getNumber(instance['00181063']),
            frameTimeVector: parseFloatArray(DICOMWeb.getString(instance['00181065'])),
            sliceThickness: DICOMWeb.getNumber(instance['00180050']),
            lossyImageCompression: DICOMWeb.getString(instance['00282110']),
            derivationDescription: DICOMWeb.getString(instance['00282111']),
            lossyImageCompressionRatio: DICOMWeb.getString(instance['00282112']),
            lossyImageCompressionMethod: DICOMWeb.getString(instance['00282114']),
            baseWadoRsUri: server.wadoRoot + '/studies/' + studyInstanceUid + '/series/' + seriesInstanceUid + '/instances/' + sopInstanceUid
        };

        // Get additional information if the instance uses "PALETTE COLOR" photometric interpretation
        if (instanceSummary.photometricInterpretation === 'PALETTE COLOR') {
            let palettes = getPaletteColors(server, instance);
            if (palettes) {
                if (palettes.uid) {
                    instanceSummary.paletteColorLookupTableUID = palettes.uid;
                }
                instanceSummary.redPaletteColorLookupTable = palettes.red;
                instanceSummary.greenPaletteColorLookupTable = palettes.green;
                instanceSummary.bluePaletteColorLookupTable = palettes.blue;
                instanceSummary.redPaletteColorLookupTableDescriptor = parseFloatArray(DICOMWeb.getString(instance['00281101']));
                instanceSummary.greenPaletteColorLookupTableDescriptor = parseFloatArray(DICOMWeb.getString(instance['00281102']));
                instanceSummary.bluePaletteColorLookupTableDescriptor = parseFloatArray(DICOMWeb.getString(instance['00281103']));
            }
        }

        if (server.imageRendering === 'wadouri') {
            instanceSummary.wadouri = WADOProxy.convertURL(server.wadoUriRoot + '?requestType=WADO&studyUID=' + studyInstanceUid + '&seriesUID=' + seriesInstanceUid + '&objectUID=' + sopInstanceUid + '&contentType=application%2Fdicom', server.requestOptions);
        } else {
            instanceSummary.wadorsuri = server.wadoRoot + '/studies/' + studyInstanceUid + '/series/' + seriesInstanceUid + '/instances/' + sopInstanceUid + '/frames/1';
        }

        instanceSummary.wadorsuri = WADOProxy.convertURL(server.wadoRoot + '/studies/' + studyInstanceUid + '/series/' + seriesInstanceUid + '/instances/' + sopInstanceUid + '/frames/1');

        series.instances.push(instanceSummary);

    });

    return studyData;
}

/**
 * Retrieved Study MetaData from a DICOM server using a WADO call
 * @param server
 * @param studyInstanceUid
 * @returns {{seriesList: Array, patientName: *, patientId: *, accessionNumber: *, studyDate: *, modalities: *, studyDescription: *, imageCount: *, studyInstanceUid: *}}
 */
Services.WADO.RetrieveMetadata = function(server, studyInstanceUid) {
    var url = buildUrl(server, studyInstanceUid);

    var result = DICOMWeb.getJSON(url, server.requestOptions);

    var study = resultDataToStudyMetadata(server, studyInstanceUid, result.data);
    if (!study) {
        study = {};
    }

    study.wadoUriRoot = server.wadoUriRoot;
    study.studyInstanceUid = studyInstanceUid;

    return study;
};
