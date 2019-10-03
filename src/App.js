import React, { Component } from 'react';
import axios from 'axios';

const TITLE = 'React ISSUES';

const axiosGitHubGraphQL = axios.create({
  baseURL: 'https://api.github.com/graphql',
  headers: {
    Authorization: `bearer ${
      process.env.REACT_APP_GITHUB_PERSONAL_ACCESS_TOKEN
    }`,
  },
});

const GET_ISSUES_OF_REPOSITORY = `
  query ($organization: String!, $repository: String!, $cursor: String) {
    organization(login: $organization) {
      name
      url
      repository(name: $repository) {
        id
        name
        url
        stargazers {
          totalCount
        }
        viewerHasStarred
        issues(first: 15, after: $cursor, states: [OPEN]) {
          edges {
            node {
              id
              title
              url
            }
          }
          totalCount
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }
  }
`;
const SEARCH_ISSUES = `query($query: String!) {
  search(first: 15, type: ISSUE, query: $query) {
    issueCount
    pageInfo {
      hasNextPage
      endCursor
    }
    edges {
      node {
        ... on Issue {
          createdAt
          title
          url,
          repository {
            name
          }
        }
      }
    }
  }
}`;
const getIssuesOfRepository = (path, cursor) => {
  const [organization, repository] = path.split('/');

  return axiosGitHubGraphQL.post('', {
    query: GET_ISSUES_OF_REPOSITORY,
    variables: { organization, repository, cursor },
  });
};
const searchIssuesOfRepository = (path, cursor, query) => {
  const [organization, repository] = path.split('/');
  return axiosGitHubGraphQL.post('', {
    query: SEARCH_ISSUES,
    variables: { repository, cursor, query },
  });
};

const resolveIssuesQuery = (queryResult, cursor) => state => {
  const { data, errors } = queryResult.data;
  if (!cursor) {
    return {
      organization: data.organization,
      errors,
    };
  }
  const { edges: oldIssues } = state.organization.repository.issues;
  const { edges: newIssues } = data.organization.repository.issues;
  const updatedIssues = [...oldIssues, ...newIssues];

  return {
    organization: {
      ...data.organization,
      repository: {
        ...data.organization.repository,
        issues: {
          ...data.organization.repository.issues,
          edges: updatedIssues,
        },
      },
    },
    errors,
  };
};
const resolveSearchIssuesQuery = (queryResult, cursor) => state => {
  const { data, errors } = queryResult.data;
  const { edges: oldIssues } = state.organization.repository.issues;
  const { edges: newIssues } = data.search;
  const updatedIssues = [...newIssues];

  return {
    organization: {
      ...state.organization,
      repository: {
        ...state.organization.repository,
        issues: {
          ...data.search,
          edges: updatedIssues,
        },
      },
    },
    errors,
  };
};


class App extends Component {
  state = {
    path: 'facebook/react',
    organization: null,
    errors: null,
    query:'',
  };

  componentDidMount() {
    this.onFetchFromGitHub(this.state.path);
  }

  onChange = event => {
    this.setState({ query: event.target.value });
  };

  onSubmit = event => {
    this.onSearchFromGitHub(this.state.path);
    event.preventDefault();
  };
  onSearchFromGitHub = (path, cursor) => {
    searchIssuesOfRepository(path, cursor, this.state.query).then(queryResult => console.log('search',queryResult) ||
      this.setState(resolveSearchIssuesQuery(queryResult, cursor)),
    );
  };

  onFetchFromGitHub = (path, cursor) => {
    getIssuesOfRepository(path, cursor).then(queryResult => console.log('all',queryResult) ||
      this.setState(resolveIssuesQuery(queryResult, cursor)),
    );
  };

  onFetchMoreIssues = () => {
    const {
      endCursor,
    } = this.state.organization.repository.issues.pageInfo;

    this.onFetchFromGitHub(this.state.path, endCursor);
  };
  render() {
    const { path, organization, errors } = this.state;

    return (
      <div>
        <h1>{TITLE}</h1>

        <form onSubmit={this.onSubmit}>
          <input
            id="url"
            type="text"
            placeholder="Search open issues"
            onChange={this.onChange}
            style={{ width: '300px' }}
          />
          <button type="submit">Search</button>
        </form>

        <hr />

        {organization ? (
          <Organization
            organization={organization}
            errors={errors}
            onFetchMoreIssues={this.onFetchMoreIssues}
            onStarRepository={this.onStarRepository}
          />
        ) : (
          <p>No information yet ...</p>
        )}
      </div>
    );
  }
}

const Organization = ({
  organization,
  errors,
  onFetchMoreIssues,
  onStarRepository,
}) => {
  if (errors) {
    return (
      <p>
        <strong>Something went wrong:</strong>
        {errors.map(error => error.message).join(' ')}
      </p>
    );
  }

  return (
    <div>
      <p>
        <strong>Issues from Organization:</strong>
        <a href={organization.url}>{organization.name}</a>
      </p>
      <Repository
        repository={organization.repository}
        onFetchMoreIssues={onFetchMoreIssues}
        onStarRepository={onStarRepository}
      />
    </div>
  );
};

const Repository = ({
  repository,
  onFetchMoreIssues,
  onStarRepository,
}) => (
  <div>
    <p>
      <strong>In Repository:</strong>
      <a href={repository.url}>{repository.name}</a>
    </p>
    <ul>
      {repository.issues.edges.map(issue => (
        <li key={issue.node.id}>
          <a href={issue.node.url}>{issue.node.title}</a>
        </li>
      ))}
    </ul>

    <hr />

    {repository.issues.pageInfo.hasNextPage && (
      <button onClick={onFetchMoreIssues}>More</button>
    )}
  </div>
);

export default App;
