"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const lodash_1 = __importDefault(require("lodash"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const token = core.getInput('access-token', { required: true });
            const org = core.getInput('org', { required: true });
            const reviewTeamSlug = core.getInput('review-team-slug', { required: true });
            if (!token || !org || !reviewTeamSlug) {
                core.debug('Please provide access-token, org and review-team-slug');
                return;
            }
            const prNumber = getPrNumber();
            if (!prNumber) {
                core.debug('Could not get pull request number from context');
                return;
            }
            const teamName = `${lodash_1.default.capitalize(reviewTeamSlug)}-Team`;
            const client = new github.GitHub(token);
            core.setOutput('PROCESSING', `Fetching changed files for pr #${prNumber}`);
            const changedFiles = yield getChangedFiles(client, prNumber);
            const hasChanges = hasStyleChanges(changedFiles);
            if (hasChanges) {
                core.setOutput('STATUS:', `Checking ${teamName} approval status`);
                const approvedReviewers = yield getApprovedReviews(client, prNumber);
                let approvalNeeded = true;
                if (approvedReviewers.length) {
                    console.log(`Pull request is approved by ${approvedReviewers.join(', ')}`);
                    const reviewTeamMembers = yield getReviewers(client, org, reviewTeamSlug);
                    if (lodash_1.default.isEmpty(reviewTeamMembers)) {
                        core.setFailed(`${teamName} has no members`);
                        return;
                    }
                    else if (lodash_1.default.intersection(approvedReviewers, reviewTeamMembers).length > 0) {
                        approvalNeeded = false;
                    }
                }
                if (approvalNeeded) {
                    core.setFailed(`${teamName} approval needed`);
                }
                else {
                    core.setOutput(`${teamName} approved changes.`, '0');
                }
            }
            else {
                core.setOutput(`No approval needed from ${teamName}`, '0');
            }
        }
        catch (error) {
            core.error(error);
            core.setFailed(error.message);
        }
    });
}
function getReviewers(client, org, reviewTeamSlug) {
    return __awaiter(this, void 0, void 0, function* () {
        const team = yield client.teams.getByName({
            org,
            team_slug: reviewTeamSlug,
        });
        if (!team) {
            return [];
        }
        const teamId = team.data.id;
        const members = yield client.teams.listMembers({
            team_id: teamId,
        });
        return lodash_1.default.map(members.data, 'login');
    });
}
function getApprovedReviews(client, prNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        const listReviewRequests = yield client.pulls.listReviews({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            pull_number: prNumber,
        });
        return lodash_1.default(listReviewRequests.data)
            .filter({ state: 'APPROVED' })
            .map('user.login')
            .uniq()
            .value();
    });
}
function getPrNumber() {
    const payload = github.context.payload;
    let pullRequest = payload.pull_request;
    if (!pullRequest && payload.action === 'rerequested') {
        pullRequest = payload.check_suite.pull_requests[0];
    }
    if (!pullRequest) {
        return undefined;
    }
    return pullRequest.number;
}
function getChangedFiles(client, prNumber) {
    return __awaiter(this, void 0, void 0, function* () {
        const listFilesResponse = yield client.pulls.listFiles({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            pull_number: prNumber
        });
        const changedFiles = listFilesResponse.data.map(f => f.filename);
        return changedFiles;
    });
}
function hasStyleChanges(changedFiles) {
    if (lodash_1.default.isEmpty(changedFiles)) {
        return false;
    }
    return lodash_1.default.some(changedFiles, fileName => (lodash_1.default.endsWith(fileName, '.scss')
        || lodash_1.default.endsWith(fileName, '.css')
        || lodash_1.default.includes(fileName, 'app/modules/Common')));
}
run();