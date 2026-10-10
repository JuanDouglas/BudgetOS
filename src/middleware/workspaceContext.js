import ClientWorkspace from '../models/ClientWorkspace.js';

/** Resolves the selected workspace only after route authentication has populated req.user. */
export const resolveWorkspaceContext = (req, res, next) => {
  const actor = req.user;
  const requestedWorkspaceId = req.get('X-Workspace-ID') || req.session?.activeWorkspaceId;
  ClientWorkspace.resolveContext(requestedWorkspaceId, actor.id)
    .then((workspace) => {
      req.actorUser = actor;
      req.workspace = workspace;

      if (workspace) {
        req.user = {
          ...actor,
          id: workspace.dataUserId,
          locale: workspace.locale,
          currency: workspace.currency,
          decimalSeparator: workspace.decimalSeparator,
          digitGrouping: workspace.digitGrouping,
        };
      }

      next();
    })
    .catch(next);
};
