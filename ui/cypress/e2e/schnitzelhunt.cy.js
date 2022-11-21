/// <reference types="cypress" />

// Welcome to Cypress!
//
// This spec file contains a variety of sample tests
// for a todo list app that are designed to demonstrate
// the power of writing tests in Cypress.
//
// To learn more about how Cypress works and
// what makes it such an awesome testing tool,
// please read our getting started guide:
// https://on.cypress.io/introduction-to-cypress

describe('Schnitzelhunt e2e', () => {
  beforeEach(() => {
    // Cypress starts out with a blank slate for each test
    // so we must tell it to visit our website with the `cy.visit()` command.
    // Since we want to visit the same URL at the start of all our tests,
    // we include it in our beforeEach function so that it runs before each test
    cy.visit('/')
  })

  it('shows intro screen', () => {

    // shows intro screen components
    cy.get('#title').parent()
    .get('#title').should('have.text', 'zk schnitzeljagd')
    cy.get('#start-game').should('be.enabled')
    cy.get('#start-game').should('have.text', 'START NEW GAME')

    // clicking start game button will lead you to game screen showing first riddle
    cy.get('#start-game').click({force: true})
    cy.get('#riddle1').parent().get('#riddle1').should('have.text', 'I\'ve got an anchor, but have no sail. My sound makes Hooks\' mind derail. Stand underneath, close in the middle, share your location to solve this riddle. ')
  })

  it('can play the game successfully', () => {
    // load game page with first location
    cy.visit('/game', {
      onBeforeLoad ({ navigator }) {
        const latitude = 48.2107958217
        const longitude = 16.3736155926
       cy.stub(navigator.geolocation, 'getCurrentPosition')
         .callsArgWith(0, { coords: { latitude, longitude } })
      }
    })

    cy.wait(10000) // wait for game to load

    // first riddle should be shown

    cy.get('#riddle1').parent().get('#riddle1').should('have.text', 'I\'ve got an anchor, but have no sail. My sound makes Hooks\' mind derail. Stand underneath, close in the middle, share your location to solve this riddle. ')
    cy.get('#share-location').should('have.text', 'Solve by sharing your location 👉 ')

    // share location to solve first riddle
    cy.get('#share-location-btn').find('svg').click({force: true})
  })
})
