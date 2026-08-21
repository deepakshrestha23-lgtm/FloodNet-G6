const centreService = require('../services/centre.service');

async function list(request, response) {
  const centres = await centreService.listCentres(request.centreQuery);

  response.status(200).json({
    success: true,
    data: { centres },
    message: 'Evacuation centres retrieved successfully'
  });
}

async function get(request, response) {
  const centre = await centreService.getCentre(request.params.id);

  response.status(200).json({
    success: true,
    data: { centre },
    message: 'Evacuation centre retrieved successfully'
  });
}

async function create(request, response) {
  const centre = await centreService.createCentre(request.user, request.centreInput);

  response.status(201).json({
    success: true,
    data: { centre },
    message: 'Evacuation centre created successfully'
  });
}

async function update(request, response) {
  const centre = await centreService.updateCentre(request.user, request.params.id, request.centreInput);

  response.status(200).json({
    success: true,
    data: { centre },
    message: 'Evacuation centre updated successfully'
  });
}

async function updateOccupancy(request, response) {
  const centre = await centreService.updateOccupancy(
    request.user,
    request.params.id,
    request.occupancyInput.currentOccupancy
  );

  response.status(200).json({
    success: true,
    data: { centre },
    message: 'Occupancy updated successfully'
  });
}

async function updateStatus(request, response) {
  const centre = await centreService.updateStatus(
    request.user,
    request.params.id,
    request.statusInput.operationalStatus
  );

  response.status(200).json({
    success: true,
    data: { centre },
    message: 'Operational status updated successfully'
  });
}

async function archive(request, response) {
  const centre = await centreService.archiveCentre(request.user, request.params.id);

  response.status(200).json({
    success: true,
    data: { centre },
    message: 'Evacuation centre archived successfully'
  });
}

async function facilityTypes(_request, response) {
  const facilityTypes = await centreService.listFacilityTypes();

  response.status(200).json({
    success: true,
    data: { facilityTypes },
    message: 'Facility types retrieved successfully'
  });
}

async function dashboard(request, response) {
  const data = await centreService.getDashboard(request.user, request.geographyQuery);

  response.status(200).json({
    success: true,
    data,
    message: 'Evacuation dashboard retrieved successfully'
  });
}

module.exports = {
  list,
  get,
  create,
  update,
  updateOccupancy,
  updateStatus,
  archive,
  facilityTypes,
  dashboard
};
