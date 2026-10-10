import ClientWorkspace from '../models/ClientWorkspace.js';

export const listWorkspaces = async (req, res) => {
  const personal = await ClientWorkspace.ensurePersonal(req.user.id);
  const activeId = await ClientWorkspace.findAccessible(req.session.activeWorkspaceId, req.user.id)
    ? req.session.activeWorkspaceId
    : personal.id;
  req.session.activeWorkspaceId = activeId;

  const workspaces = await ClientWorkspace.findAllForUser(req.user.id, activeId);
  const activeWorkspace = workspaces.find((workspace) => workspace.active);
  res.json({ success: true, data: { workspaces, activeWorkspace } });
};

export const createWorkspace = async (req, res) => {
  const workspace = await ClientWorkspace.create(req.user.id, req.body);
  req.session.activeWorkspaceId = workspace.id;
  res.status(201).json({ success: true, data: { workspace } });
};

export const activateWorkspace = async (req, res) => {
  const workspace = await ClientWorkspace.getAccessibleOrFail(req.params.workspaceId, req.user.id);
  req.session.activeWorkspaceId = workspace.id;
  res.json({ success: true, data: { workspace } });
};
