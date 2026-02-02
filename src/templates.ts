export type Template = {
  /** Template name */
  name: string;
  /** Template description */
  description: string;
  /** Template repository URL */
  repo: string;
  /** Template checkout options */
  options?: string[];
  /** Template package manager */
  packageManager?: string;
};

export const defaultTemplates: Template[] = [
    {
        name: "starter",
        description: "A starter template for Patternfly react typescript project",
        repo: "https://github.com/patternfly/patternfly-react-seed.git",
        packageManager: "yarn"
    },
    {
        name: "compass-starter",
        description: "A starter template for Patternfly compass theme typescript project",
        repo: "https://github.com/patternfly/patternfly-react-seed.git",
        options: ["--single-branch", "--branch", "compass_theme"],
        packageManager: "yarn"
    },
    {
        name: "nextjs-starter",
        description: "A starter template for Patternfly nextjs project",
        repo: "git@github.com:patternfly/patternfly-nextjs-seed.git",
        packageManager: "yarn"
    },
    {
        name: "ai_enabled_starter",
        description: "A starter template for Patternfly ai enabled project",
        repo: "https://github.com/patternfly/patternfly-react-seed.git",
        options: ["--single-branch", "--branch", "ai_enabled"]
    }
]

export default defaultTemplates;