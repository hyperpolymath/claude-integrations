// SPDX-License-Identifier: MPL-2.0
// SPDX-FileCopyrightText: 2026 Jonathan D.A. Jewell

/**
 * Multi-Repository Support
 * Manages multiple GitLab projects simultaneously
 */

// Repository configuration
// `type rec` required for the `and repoFeatures` chain below
// (ReScript 12 enforces explicit `rec` for mutually recursive types).
type rec repoConfig = {
  id: string,
  projectId: string,
  gitlabUrl: string,
  name: string,
  description: option<string>,
  enabled: bool,
  webhookSecret: option<string>,
  features: repoFeatures,
}

and repoFeatures = {
  issueAnalysis: bool,
  mrReview: bool,
  autoRespond: bool,
  customPrompts: bool,
}

// Multi-repo configuration
type multiRepoConfig = {
  repositories: array<repoConfig>,
  defaultGitlabUrl: string,
  sharedWebhookSecret: option<string>,
}

// Repository registry
type repoRegistry = {
  repos: Dict.t<repoConfig>,
  byProjectId: Dict.t<repoConfig>,
}

// Create empty registry
let makeRegistry = (): repoRegistry => {
  repos: Dict.make(),
  byProjectId: Dict.make(),
}

// Add repository to registry
let addRepo = (registry: repoRegistry, config: repoConfig): repoRegistry => {
  registry.repos->Dict.set(config.id, config)
  registry.byProjectId->Dict.set(config.projectId, config)
  registry
}

// Get repository by ID
let getRepoById = (registry: repoRegistry, id: string): option<repoConfig> => {
  registry.repos->Dict.get(id)
}

// Get repository by project ID
let getRepoByProjectId = (registry: repoRegistry, projectId: string): option<repoConfig> => {
  registry.byProjectId->Dict.get(projectId)
}

// Get all enabled repositories
let getEnabledRepos = (registry: repoRegistry): array<repoConfig> => {
  registry.repos
  ->Dict.valuesToArray
  ->Array.filter(repo => repo.enabled)
}

// Validate repository configuration
let validateRepoConfig = (config: repoConfig): result<unit, string> => {
  if config.id->String.trim->String.length == 0 {
    Error("Repository ID cannot be empty")
  } else if config.projectId->String.trim->String.length == 0 {
    Error("Project ID cannot be empty")
  } else if config.name->String.trim->String.length == 0 {
    Error("Repository name cannot be empty")
  } else {
    Ok()
  }
}

// Load configuration from JSON
let parseRepoConfig = (json: JSON.t): result<repoConfig, string> => {
  try {
    // Simplified parsing - real implementation would use proper JSON decoder
    let obj = json->JSON.Decode.object->Option.getOrThrow

    let id = obj
      ->Dict.get("id")
      ->Option.flatMap(JSON.Decode.string)
      ->Option.getOrThrow

    let projectId = obj
      ->Dict.get("projectId")
      ->Option.flatMap(JSON.Decode.string)
      ->Option.getOrThrow

    let gitlabUrl = obj
      ->Dict.get("gitlabUrl")
      ->Option.flatMap(JSON.Decode.string)
      ->Option.getOr("https://gitlab.com")

    let name = obj
      ->Dict.get("name")
      ->Option.flatMap(JSON.Decode.string)
      ->Option.getOrThrow

    let enabled = obj
      ->Dict.get("enabled")
      ->Option.flatMap(JSON.Decode.bool)
      ->Option.getOr(true)

    let config: repoConfig = {
      id,
      projectId,
      gitlabUrl,
      name,
      description: obj->Dict.get("description")->Option.flatMap(JSON.Decode.string),
      enabled,
      webhookSecret: obj->Dict.get("webhookSecret")->Option.flatMap(JSON.Decode.string),
      features: {
        issueAnalysis: true,
        mrReview: true,
        autoRespond: true,
        customPrompts: true,
      },
    }

    validateRepoConfig(config)->Result.map(_ => config)
  } catch {
  | _ => Error("Failed to parse repository configuration")
  }
}

// Load multiple repositories from JSON
let parseMultiRepoConfig = (json: JSON.t): result<multiRepoConfig, string> => {
  try {
    // ReScript 12 / @rescript/core changes used here:
    //   * `Option.getOrThrow` → `Option.getOrThrow`
    //   * `Array.keepSome` no longer takes a transform; it just
    //     filters `array<option<_>>` → `array<_>`. The combined
    //     filter+map pattern is now `Array.filterMap`.
    let obj = json->JSON.Decode.object->Option.getOrThrow

    let reposJson =
      obj->Dict.get("repositories")->Option.flatMap(JSON.Decode.array)->Option.getOrThrow

    let repos = reposJson->Array.map(parseRepoConfig)->Array.filterMap(result =>
      switch result {
      | Ok(config) => Some(config)
      | Error(_) => None
      }
    )

    Ok({
      repositories: repos,
      defaultGitlabUrl: "https://gitlab.com",
      sharedWebhookSecret: None,
    })
  } catch {
  | _ => Error("Failed to parse multi-repository configuration")
  }
}

// Build registry from configuration
let buildRegistry = (config: multiRepoConfig): repoRegistry => {
  let registry = makeRegistry()
  config.repositories->Array.reduce(registry, (reg, repo) => addRepo(reg, repo))
}

// Route webhook event to appropriate repository
let routeWebhook = (
  registry: repoRegistry,
  ~projectId: string,
): option<repoConfig> => {
  getRepoByProjectId(registry, projectId)
}

// Get repository statistics
type repoStats = {
  totalRepos: int,
  enabledRepos: int,
  disabledRepos: int,
  gitlabUrls: array<string>,
}

let getStats = (registry: repoRegistry): repoStats => {
  let all = registry.repos->Dict.valuesToArray
  let enabled = all->Array.filter(r => r.enabled)
  let disabled = all->Array.filter(r => !r.enabled)
  // ReScript 12: `Array.toSet` was removed; use `Set.fromArray`
  // directly to deduplicate the URL array.
  let urls = all
    ->Array.map(r => r.gitlabUrl)
    ->Set.fromArray
    ->Set.toArray

  {
    totalRepos: all->Array.length,
    enabledRepos: enabled->Array.length,
    disabledRepos: disabled->Array.length,
    gitlabUrls: urls,
  }
}

// Export configuration to JSON
let exportConfig = (config: multiRepoConfig): JSON.t => {
  let repos = config.repositories->Array.map(repo => {
    JSON.Encode.object(
      Dict.fromArray([
        ("id", JSON.Encode.string(repo.id)),
        ("projectId", JSON.Encode.string(repo.projectId)),
        ("gitlabUrl", JSON.Encode.string(repo.gitlabUrl)),
        ("name", JSON.Encode.string(repo.name)),
        ("enabled", JSON.Encode.bool(repo.enabled)),
      ]),
    )
  })

  JSON.Encode.object(
    Dict.fromArray([
      ("repositories", JSON.Encode.array(repos)),
      ("defaultGitlabUrl", JSON.Encode.string(config.defaultGitlabUrl)),
    ]),
  )
}
