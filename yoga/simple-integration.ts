import { createServer } from 'http'
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node'
import { Layer } from 'effect'
import { createSchema, createYoga } from 'graphql-yoga'

const schema = createSchema({
  typeDefs: `
    type Pet {
      id: ID!
      name: String!
      type: String!
      age: Int
      owner: Owner
    }

    type Owner {
      id: ID!
        name: String!
        pets: [Pet!]
      }

      type Query {
        pets: [Pet!]!
        pet(id: ID!): Pet
        owners: [Owner!]!
        owner(id: ID!): Owner
      }

      type Mutation {
        addPet(name: String!, type: String!, age: Int): Pet!
        assignPetToOwner(petId: ID!, ownerId: ID!): Pet!
        addOwner(name: String!): Owner!
      }
  `,
})

const yogaServer = createYoga({ schema })

const server = NodeHttpServer.layer(() => createServer(yogaServer), {
  port: 8080,
})

Layer.launch(server).pipe(NodeRuntime.runMain)
