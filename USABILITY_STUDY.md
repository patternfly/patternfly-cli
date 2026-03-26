# PatternFly CLI Usability Study

## Study Overview

### Objectives
- Evaluate the ease of use and intuitiveness of the PatternFly CLI
- Identify pain points in the user journey from installation to project deployment
- Assess the clarity of command structure and help documentation
- Measure user satisfaction with interactive prompts and feedback
- Validate the effectiveness of error messages and recovery paths

### Target Audience
- **Primary**: Frontend developers (1-5 years experience) working with React and PatternFly
- **Secondary**: Senior developers and tech leads evaluating the CLI for team adoption
- **Tertiary**: New developers learning PatternFly for the first time

### Study Duration
- Individual sessions: 45-60 minutes per participant
- Total study period: 2-3 weeks
- Target participants: 8-12 users (mix of experience levels)

---

## Methodology

### Session Format
- **Remote moderated sessions** via video call with screen sharing
- **Think-aloud protocol**: Participants verbalize their thoughts while completing tasks
- **Post-task questionnaires**: Standardized usability metrics (SUS, task difficulty ratings)
- **Semi-structured interview**: Open-ended questions about experience

### Materials Needed
- Test environment with Node.js, npm, and GitHub CLI pre-installed
- Clean system without PatternFly CLI pre-installed
- Recording software for session capture (with participant consent)
- Note-taking template for observers

---

## Pre-Study Screening

### Participant Criteria
- Active software developer (currently writing code professionally or in personal projects)
- Familiarity with command-line tools
- Experience with npm/package managers
- Mix of PatternFly experience levels (0-2 years: 40%, 3-5 years: 40%, 5+ years: 20%)

### Screening Questions
1. How many years of experience do you have with frontend development?
2. How comfortable are you using command-line tools? (Scale 1-5)
3. Have you used PatternFly before? If yes, for how long?
4. Which package manager do you primarily use? (npm/yarn/pnpm)
5. Have you created projects from CLI scaffolding tools before? (e.g., create-react-app, Vite, Angular CLI)

---

## Task Scenarios

### Task 1: Installation and Setup
**Objective**: Assess the ease of installing and verifying the CLI

**Scenario**: "You've just joined a team that uses PatternFly. Install the PatternFly CLI globally on your machine and verify it's working."

**Success Criteria**:
- Successfully runs `npm install -g patternfly-cli`
- Verifies installation by running `patternfly-cli --version` or `patternfly-cli --help`
- Completes within 5 minutes

**Metrics**:
- Time to completion
- Number of errors encountered
- Need for external documentation
- Task difficulty rating (1-7 scale)

**Follow-up Questions**:
- Was the installation process clear?
- Did you know where to look if something went wrong?
- Was the command name intuitive?

---

### Task 2: Discovering Available Commands
**Objective**: Evaluate command discoverability and help system

**Scenario**: "Before creating a project, explore what the PatternFly CLI can do. Find out what commands are available and what templates you can use."

**Success Criteria**:
- Discovers `--help` flag or runs help command
- Finds and runs `patternfly-cli list` command
- Understands the purpose of at least 3 commands

**Metrics**:
- Time to discover help documentation
- Commands explored
- Understanding of available templates (comprehension check)
- Task difficulty rating

**Follow-up Questions**:
- How did you find information about available commands?
- Was the help output clear and useful?
- Was the list of templates presented in a helpful way?

---

### Task 3: Creating a New Project (Interactive Mode)
**Objective**: Test the primary use case with interactive prompts

**Scenario**: "Create a new PatternFly project called 'my-dashboard' using any template you think is appropriate. Don't provide the template name in the command - let the CLI guide you."

**Success Criteria**:
- Runs `patternfly-cli create` without arguments
- Successfully navigates interactive prompts
- Provides project details (name, version, description, author)
- Project is created and dependencies are installed
- Completes within 10 minutes

**Metrics**:
- Time to completion
- Number of times user needs to reference documentation
- Comprehension of prompts
- Satisfaction with interactive flow
- Task difficulty rating

**Observations**:
- Does the user understand each prompt?
- Do they hesitate at any point?
- Are default values helpful?
- Is the template selection list overwhelming or clear?

**Follow-up Questions**:
- How did you feel about the interactive prompts?
- Were the questions clear and in a logical order?
- Were the default values helpful or confusing?
- Was the feedback during the process reassuring?

---

### Task 4: Creating a Project (Direct Command)
**Objective**: Test efficiency for experienced users

**Scenario**: "Now that you're familiar with the CLI, create another project called 'my-app' using a specific template of your choice. Try to do this as quickly as possible by providing all information upfront."

**Success Criteria**:
- Runs `patternfly-cli create my-app [template-name]`
- Successfully creates project without prompts
- Completes within 5 minutes

**Metrics**:
- Time to completion
- Whether user remembers command structure
- Task difficulty rating

**Follow-up Questions**:
- Did you prefer this method or the interactive prompts? Why?
- Was the command structure intuitive?
- Did you need to reference help documentation?

---

### Task 5: Working with Custom Templates
**Objective**: Evaluate advanced feature usability

**Scenario**: "Your team has a custom template they want you to use. Create a JSON file with a custom template definition and use it to list available templates."

**Provided Information**: Give participants a sample JSON structure:
```json
[
  {
    "name": "team-template",
    "description": "My team's custom template",
    "repo": "https://github.com/example/template.git",
    "options": ["--single-branch", "--branch", "main"],
    "packageManager": "npm"
  }
]
```

**Success Criteria**:
- Creates the JSON file
- Runs `patternfly-cli list --template-file ./custom-templates.json`
- Sees both built-in and custom templates

**Metrics**:
- Time to completion
- Understanding of JSON structure
- Task difficulty rating
- Errors encountered

**Follow-up Questions**:
- Was the custom template feature discoverable?
- Was the JSON format intuitive?
- Can you think of use cases for this feature?

---

### Task 6: Initializing Git and GitHub Repository
**Objective**: Test git/GitHub integration workflow

**Scenario**: "Navigate to the 'my-dashboard' project you created earlier and initialize it as a git repository. Create a corresponding GitHub repository for it."

**Success Criteria**:
- Runs `patternfly-cli init` in project directory
- Successfully creates local git repository
- Chooses to create GitHub repository when prompted
- Repository is created and connected

**Metrics**:
- Time to completion
- Understanding of GitHub CLI integration
- Task difficulty rating
- User confidence with the process

**Follow-up Questions**:
- Did you expect the CLI to offer GitHub repository creation?
- Was the integration with GitHub CLI smooth?
- What would you have done differently without this feature?

---

### Task 7: Updating a Project with Codemods
**Objective**: Assess the update command usability

**Scenario**: "Imagine your project uses an older version of PatternFly and you need to update the code to use the latest patterns. Run the update command on the project's src directory."

**Success Criteria**:
- Runs `patternfly-cli update` or `patternfly-cli update src`
- Understands the difference between `--fix` flag and dry-run
- Comprehends the output

**Metrics**:
- Time to completion
- Understanding of what the command does
- Task difficulty rating
- Confidence in using `--fix` flag

**Follow-up Questions**:
- Was it clear what the update command would do?
- Did you feel comfortable running it on your code?
- Was the output clear about what changed?
- Would you have preferred more control or less?

---

### Task 8: Deploying to GitHub Pages
**Objective**: Test deployment workflow

**Scenario**: "Your project is ready to share. Deploy your 'my-dashboard' project to GitHub Pages."

**Success Criteria**:
- Runs `patternfly-cli deploy` in project directory
- Understands build process
- Successfully deploys to GitHub Pages
- Can access the deployed site

**Metrics**:
- Time to completion
- Understanding of deployment options (--dist-dir, --no-build, --branch, --base)
- Task difficulty rating
- Success rate

**Follow-up Questions**:
- Was the deployment process straightforward?
- Were you confident the deployment succeeded?
- Were the options (dist-dir, branch, base path) clear?
- How does this compare to other deployment methods you've used?

---

### Task 9: Error Recovery
**Objective**: Test error handling and messaging

**Scenario**: "Try to create a project in a directory that already exists."

**Success Criteria**:
- Receives clear error message
- Understands why the error occurred
- Knows how to resolve the issue

**Metrics**:
- Clarity of error message (1-7 scale)
- User ability to self-recover
- Emotional response to error

**Follow-up Questions**:
- Was the error message helpful?
- Did you know what to do to fix the problem?
- How did you feel when you encountered the error?

---

## Metrics and Data Collection

### Quantitative Metrics

#### Task Performance
- **Task completion rate**: % of users who successfully complete each task
- **Time on task**: Average and median time for each task
- **Error rate**: Number of errors per task
- **Efficiency**: Task completion time for successful vs. unsuccessful attempts

#### Usability Scores
- **System Usability Scale (SUS)**: Post-study standardized questionnaire (target: >70)
- **Task difficulty ratings**: 7-point scale (1=very easy, 7=very difficult) (target: ≤3)
- **Confidence ratings**: 7-point scale for task confidence (target: ≥5)
- **Net Promoter Score (NPS)**: Likelihood to recommend (target: ≥30)

### Qualitative Data

#### Observation Notes
- User comments during think-aloud
- Points of confusion or hesitation
- Positive reactions and "aha" moments
- Workarounds or unexpected approaches
- Places where users consult documentation

#### Interview Responses
- Overall impression of the CLI
- Comparison to similar tools
- Missing features or improvements
- Favorite and least favorite aspects
- Likelihood of adoption

---

## Post-Study Questionnaire

### System Usability Scale (SUS)
Rate your agreement with each statement (1=Strongly Disagree, 5=Strongly Agree):

1. I think I would like to use this CLI frequently
2. I found the CLI unnecessarily complex
3. I thought the CLI was easy to use
4. I think I would need support to use this CLI
5. I found the various commands were well integrated
6. I thought there was too much inconsistency in this CLI
7. I would imagine most people would learn to use this CLI quickly
8. I found the CLI very cumbersome to use
9. I felt very confident using the CLI
10. I needed to learn a lot before I could get going with this CLI

### Additional Questions

**Ease of Use** (1-7 scale):
- How easy was it to install the CLI?
- How easy was it to discover what the CLI can do?
- How easy was it to create your first project?
- How easy was it to understand error messages?

**Feature-Specific Questions**:
- How useful did you find the interactive prompts? (1-7)
- How clear was the template selection process? (1-7)
- How confident are you in using the update/codemod feature? (1-7)
- How likely are you to use the GitHub integration features? (1-7)

**Open-Ended Questions**:
1. What did you like most about the PatternFly CLI?
2. What did you like least or find most frustrating?
3. What features are missing that you would expect?
4. How does this compare to other scaffolding CLIs you've used?
5. What would prevent you from using this CLI in your work?
6. Any other comments or suggestions?

---

## Success Criteria

### Overall Goals
- **Task completion rate**: ≥80% for primary tasks (1-4, 6, 8)
- **Average SUS score**: ≥70 (Good)
- **Average task difficulty**: ≤3 on 7-point scale
- **NPS**: ≥30 (Favorable)
- **Time on primary task (create project)**: ≤10 minutes

### Red Flags to Watch For
- Users unable to complete basic create task without help
- Consistent confusion about command structure or naming
- Negative emotional responses (frustration, anxiety)
- Users abandoning tasks
- Requests for features that already exist (discoverability issue)

---

## Analysis Plan

### Quantitative Analysis
1. Calculate completion rates, average times, and error rates per task
2. Compute SUS score for each participant and overall average
3. Analyze task difficulty ratings and identify problem areas
4. Create efficiency metrics (e.g., time to proficiency)

### Qualitative Analysis
1. Transcribe and code think-aloud comments
2. Identify recurring themes in user feedback
3. Map pain points to specific UI/UX elements
4. Categorize feature requests and suggestions
5. Create user journey maps highlighting friction points

### Prioritization Framework
Categorize findings by:
- **Critical**: Blocking users from completing core tasks
- **High**: Causing significant frustration or time loss
- **Medium**: Minor usability issues affecting experience
- **Low**: Nice-to-have improvements

### Reporting
Create a summary report including:
1. Executive summary with key findings
2. Task-by-task analysis with metrics
3. Overall usability scores and benchmarks
4. Top 5-10 prioritized recommendations
5. User quotes and video clips illustrating key issues
6. Comparison to industry standards (if applicable)

---

## Iterations and Follow-up

### Plan for Changes
- Address critical issues immediately
- Schedule design sessions for high-priority improvements
- Create GitHub issues for all actionable feedback
- Plan follow-up lightweight testing for implemented changes

### Validation Testing
- Conduct smaller-scale testing (3-5 users) after implementing fixes
- Focus validation on areas that were redesigned
- Measure improvement in metrics for problematic tasks

---

## Appendix

### Sample Moderator Script

**Introduction** (5 minutes):
"Thank you for participating in this study. Today we're testing the PatternFly CLI, a tool for creating and managing PatternFly projects. We're interested in learning how easy or difficult it is to use.

There are no wrong answers - we're testing the tool, not you. If something is confusing or doesn't work as you expect, that's valuable feedback for us.

I'll ask you to complete some tasks using the CLI. Please think aloud as you work - tell me what you're looking for, what you expect to happen, and how you feel about what's happening.

Do you have any questions before we begin?"

**During Tasks**:
- Avoid helping unless user is completely stuck
- Use neutral prompts: "What are you thinking?", "What would you try next?"
- Note timestamps for key events
- Don't explain or defend the design

**Closing** (5 minutes):
"That's all the tasks. Thank you for your thoughtful feedback. Before we finish, I have a few final questions..."

### Consent Form Template
Include standard elements:
- Purpose of study
- How data will be used
- Recording permissions
- Confidentiality assurances
- Right to withdraw
- Contact information

### Recruitment Outreach
Sample message for recruiting participants:
"We're conducting a usability study for the PatternFly CLI and would love your feedback! Sessions are 60 minutes, remote, and we're offering [incentive]. We're looking for developers with varying levels of PatternFly experience. Interested? Reply or sign up at [link]."
