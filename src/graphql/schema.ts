export const typeDefs = `#graphql
  type Author {
    id: ID!
    name: String!
    bio: String
    nationality: String
  }

  type Review {
    id: ID!
    reviewer: String!
    rating: Int!
    comment: String
  }

  type Book {
    id: ID!
    title: String!
    year: Int!
    genre: String!
    author: Author!
    reviews: [Review!]!
  }

  type Query {
    book(id: ID!): Book
    books(limit: Int, offset: Int): [Book!]!
  }
`;
