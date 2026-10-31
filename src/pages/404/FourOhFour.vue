<template>
  <v-container class="text-center h-full">
    <v-row class="items-baseline">
      <v-col>
        <h1 class="text-5xl text-primary">Whoops, 404</h1>

        <p>The page you were looking for does not exist</p>

        <v-btn to="/book" color="primary" outlined> Get me out of here! </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  name: 'FourOhFour',
};
</script>
