import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { NavigatorScreenParams } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import MatchDetailScreen from '../screens/MatchDetailScreen';
import CreateMatchScreen from '../screens/CreateMatchScreen';
import GroupsScreen from '../screens/GroupsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import MatchHistoryScreen from '../screens/MatchHistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import GroupDetailScreen from '../screens/GroupDetailScreen';

// ── Param lists ──

export type AuthStackParamList = {
  Login: undefined;
};

export type TabParamList = {
  HomeTab: undefined;
  GroupsTab: undefined;
  CreateTab: undefined;
  ProfileTab: undefined;
  SettingsTab: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<TabParamList>;
  CreateMatch: undefined;
  MatchDetail: { matchId: string };
  MatchHistory: undefined;
  CreateGroup: undefined;
  GroupDetail: { groupId: string };
};

/** @deprecated Use RootStackParamList instead. Kept for backwards compat with screens. */
export type AppStackParamList = RootStackParamList;

// ── Navigators ──

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// ── Placeholder for Create tab (never rendered — intercepted by listener) ──

function CreateTabPlaceholder() {
  return null;
}

// ── Tab Navigator ──

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1976d2',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: { paddingBottom: 4, height: 56 },
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen
        name="GroupsTab"
        component={GroupsScreen}
        options={{ tabBarLabel: 'Groups' }}
      />
      <Tab.Screen
        name="CreateTab"
        component={CreateTabPlaceholder}
        options={{ tabBarLabel: 'Create' }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.getParent<NativeStackNavigationProp<RootStackParamList>>()?.navigate('CreateMatch');
          },
        })}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{ tabBarLabel: 'Settings' }}
      />
    </Tab.Navigator>
  );
}

// ── Auth Navigator ──

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
    </AuthStack.Navigator>
  );
}

// ── App Navigator (Root Stack wraps tabs + modal screens) ──

function AppNavigator() {
  return (
    <RootStack.Navigator>
      <RootStack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="CreateMatch"
        component={CreateMatchScreen}
        options={{ title: 'Create Match' }}
      />
      <RootStack.Screen
        name="MatchDetail"
        component={MatchDetailScreen}
        options={{ title: 'Match Detail' }}
      />
      <RootStack.Screen
        name="MatchHistory"
        component={MatchHistoryScreen}
        options={{ title: 'Match History' }}
      />
      <RootStack.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{ title: 'Create Group' }}
      />
      <RootStack.Screen
        name="GroupDetail"
        component={GroupDetailScreen}
        options={{ title: 'Group Detail' }}
      />
    </RootStack.Navigator>
  );
}

// ── Root ──

export default function RootNavigator() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <AppNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
