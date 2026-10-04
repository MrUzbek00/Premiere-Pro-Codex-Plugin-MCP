// Async UXP function body for execute_script, not a standalone Node script.
const project = await premierepro.Project.getActiveProject();
if (!project) return { project: null, message: 'No project open' };
const sequences = await project.getSequences();
return {
  name: project.name,
  path: project.path,
  sequences: sequences.map(sequence => ({ name: sequence.name, id: String(sequence.guid) }))
};
